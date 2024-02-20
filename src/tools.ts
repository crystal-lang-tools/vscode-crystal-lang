import { ChildProcess, ExecException, exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Position, TextDocument, WorkspaceFolder, window, workspace, Uri, languages, Range, Diagnostic, DiagnosticSeverity } from 'vscode';
import * as yaml from 'yaml';
import { cwd } from 'process';
import { Mutex } from 'async-mutex';
import { spawnProblemsTool } from './problems';

export const crystalOutputChannel = window.createOutputChannel("Crystal", "log")

export const compiler_mutex: Mutex = new Mutex();

/**
 * Wrapper for `exec`.
 *
 * @param {string} command full command to execute
 * @param {string} cwd directory to execute this in
 * @param {((
 * 		error: (ExecException & { stdout: string; stderr: string }) | {},
 * 		stdout: string,
 * 		stderr: string
 * 	) => void)} [callback]
 * @return {*}  {ChildProcess}
 */
function execWrapper(
	command: string,
	cwd: string,
	callback?: (
		error: (ExecException & { stdout: string; stderr: string }) | {},
		stdout: string,
		stderr: string
	) => void
): ChildProcess {
	const response = exec(command, { 'cwd': cwd }, (err, stdout, stderr) => {
		if (err) {
			callback({ ...err, stderr, stdout }, stdout, stderr);
			return;
		}

		callback(err, stdout, stderr);
	});

	return response;
}

export const execAsync = promisify(execWrapper);

/**
 * Promisify of `execWrapper`.
 *
 * @export
 * @param {string} message
 * @return {*}  {() => void}
 */
export function setStatusBar(message: string): () => void {
	const bar = window.setStatusBarMessage(`Crystal: ${message} $(loading~spin)`);
	return () => bar.dispose();
}

/**
 * Gets the path of the Crystal compiler on the system.
 *
 * @export
 * @return {*}  {Promise<string>}
 */
export async function getCompilerPath(): Promise<string> {
	const config = workspace.getConfiguration('crystal-lang');

	if (config.has('compiler')) {
		const exe = config.get<string>('compiler');
		if (path.isAbsolute(exe) && existsSync(exe)) return Promise.resolve(exe);
	}

	const command =
		(process.platform === 'win32' ? 'where' : 'which') + ' crystal';

	return (await execAsync(command, process.cwd())).trim();
}

/**
 * Gets the path of the shards executable on the system.
 *
 * @export
 * @return {*}  {Promise<string>}
 */
export async function getShardsPath(): Promise<string> {
	const config = workspace.getConfiguration('crystal-lang');

	if (config.has('shards')) {
		const exe = config.get<string>('shards');
		if (path.isAbsolute(exe) && existsSync(exe)) return Promise.resolve(exe);
	}

	const command =
		(process.platform === 'win32' ? 'where' : 'which') + ' shards';

	return (await execAsync(command, process.cwd())).trim();
}

/**
 * Gets the first target from a workspace folders `shard.yml` if it exists,
 * otherwise returns a glob of all files in `src/*`.
 *
 * @export
 * @param {WorkspaceFolder} folder
 * @return {*}  {string}
 */
export function getMainFile(folder: WorkspaceFolder): string {
	const shardFile = getShardFile(folder)
	if (existsSync(shardFile)) {
		const io = readFileSync(shardFile, 'utf8')
		const data = yaml.parse(io)

		if (data.targets !== undefined) {
			const values = Object.keys(data.targets).map(key => data.targets[key])
			// NOTE: match first targets
			if (values.length > 0) {
				return values[0].main
			}
		}
	}

	const defaultMainFile = workspace.getConfiguration('crystal-lang', folder.uri).get<string>('main', 'src/*.cr')
	return defaultMainFile
}

/**
 * Gets the `shard.yml` (if it exists) for a given workspace folder.
 *
 * @param {WorkspaceFolder} workspace
 * @return {*}  {string}
 */
function getShardFile(workspace: WorkspaceFolder): string {
	return workspace.uri.fsPath + path.sep + 'shard.yml'
}

/**
 * Returns the position of a cursor in a file in the form `/path/to/file:line:col`
 * for use by Crystal compiler tools.
 *
 * @export
 * @param {TextDocument} document
 * @param {Position} position
 * @return {*}  {string}
 */
export function getCursorPath(document: TextDocument, position: Position): string {
	// https://github.com/crystal-lang/crystal/issues/13086
	// return `${document.fileName}:${position.line + 1}:${position.character + 1}`;
	const path = `${document.fileName}:${position.line + 1}:${position.character + 1
		}`;
	if (/^\w:\\/.test(path)) return path.slice(2);
	return path;
}

/**
 * Format for an individual dependency in a `shard.yml`.
 *
 * @interface Dependency
 */
interface Dependency {
	git?: string;
	github?: string;
	gitlab: string;
	branch?: string;
	version?: string;
}

/**
 * Format of a `shard.yml` file.
 *
 * @interface Shard
 */
interface Shard {
	name: string;
	description?: string;
	version: string;
	crystal?: string;
	repository?: string;
	authors?: string[];
	dependencies?: Record<string, Dependency>;
	targets?: Record<string, Record<string, string>>;
	license?: string;
}

// Takes in a vscode TextDocument and returns the relevant
// entrypoint for it in its workspace folder

/**
 * Determines the relevant entrypoint for a Crystal file.
 * If it is a spec, the file itself is returned. If a main file is set
 * in the workspace config, that is returned. If there's a `shard.yml`
 * at the root of the workspace, it then checks targrets using the depedencies tool,
 * otherwise falls back to the first target in the `shard.yml`. If there are no targets,
 * a glob of all the files in `src/*` is returned.
 * Otherwise if there's no `shard.yml`, the file itself is returned.
 *
 * @export
 * @param {TextDocument} document
 * @return {*}  {Promise<string>}
 */
export async function getShardMainPath(document: TextDocument): Promise<string> {
	const config = workspace.getConfiguration('crystal-lang');
	const space = getWorkspaceFolder(document.uri);
	const dir = space.uri.fsPath;
	const fp = path.join(dir, 'shard.yml');

	// Specs are their own main files
	if (document.fileName.endsWith('_spec.cr')) {
		return document.fileName;
	}

	// Use main if provided and it exists
	if (config.get("main")) {
		const main = config.get<string>("main").replace("${workspaceRoot}", dir)
		if (main.includes('*') || existsSync(main)) return main;
	}

	if (config.get("dependencies")) {
		const shardTarget = await getShardTargetForFile(document)
		if (shardTarget.response) return shardTarget.response;
		if (shardTarget.error) return;
	} else if (existsSync(fp)) {
		const shard_yml = readFileSync(fp, 'utf-8')
		const shard = yaml.parse(shard_yml) as Shard;

		// Use a target with the shard name
		var main = shard.targets?.[shard.name]?.main;
		if (main && existsSync(path.resolve(dir, main))) return path.resolve(dir, main);

		if (shard.targets) {
			// Use the first target if it exists
			main = Object.values(shard.targets)[0]?.main;
			if (main && existsSync(path.resolve(dir, main))) return path.resolve(dir, main);
		}

		// Splat all top-level files in source folder,
		// only if the file is in the /src directory
		const document_path = document.uri.fsPath;
		if (document_path.includes(path.join(dir, 'src')) || document_path.includes(path.join(dir, 'lib'))) {
			return path.join(space.uri.fsPath, "src", "*.cr");
		}
	}

	// https://github.com/crystal-lang/crystal/issues/13086
	// return document.fileName;
	if (/^\w:\\/.test(document.fileName)) return document.fileName.slice(2);

	// single independent file (like a script)
	return document.fileName;
}

/**
 * Gets the Crystal source library path, i.e. `/usr/bin/../share/crystal/src`.
 *
 * @export
 * @return {*}  {Promise<string>}
 */
export async function getCrystalLibPath(): Promise<string> {
	const compiler = await getCompilerPath();
	const libpath = await execAsync(`${compiler} env CRYSTAL_PATH`, process.cwd());

	return libpath.replace(/^lib[:;]|(?:\r)?\n/g, '');
}

/**
 * Gets the main entrypoint for a given shard in the `lib/` folder of a workspace.
 *
 * @export
 * @param {TextDocument} document
 * @param {string} name
 * @return {*}  {(string | undefined)}
 */
export function getMainForShard(
	document: TextDocument,
	name: string
): string | undefined {
	const dir = getWorkspaceFolder(document.uri).uri.fsPath;
	const fp = path.join(dir, 'lib', name, 'shard.yml');
	crystalOutputChannel.appendLine(fp);
	if (!existsSync(fp)) return;

	const shard = yaml.parse(fp) as Shard;
	const main = shard.targets?.[shard.name]?.main;
	if (main) return path.resolve(dir, main);

	const mp = path.join(dir, 'lib', name, 'src', name + '.cr');
	if (existsSync(mp)) return mp;
}

/**
 * Semantic version of Crystal
 *
 * @export
 * @interface SemVer
 */
export interface SemVer {
	major: number,
	minor: number,
	patch: number
}

/**
 * Gets the version of the Crystal compiler.
 *
 * @export
 * @return {*}  {Promise<SemVer>}
 */
export async function getCrystalVersion(): Promise<SemVer> {
	const compiler = await getCompilerPath();
	const cmd = `${shellEscape(compiler)} --version`
	const response = await execAsync(cmd, cwd())

	const match = response.match(/Crystal (\d+)\.(\d+)\.(\d+)/)

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3])
	}
}

export const diagnosticCollection = languages.createDiagnosticCollection("crystal")

/**
 *  Interface for how errors are returned by the Crystal compiler.
 *
 * @interface ErrorResponse
 */
interface ErrorResponse {
	file: string
	line: number | null
	column: number | null
	size: number | null
	message: string
}

/**
 * Searches the response for JSON formatted errors. If the response is not JSON, calls
 * `findProblemsRaw` on the response.
 *
 * @export
 * @param {string} response output of Crystal compiler & tools
 * @param {Uri} uri the file these errors correspond to
 * @return {*}  {Promise<void>}
 */
export async function findProblems(response: string, uri: Uri): Promise<void> {
	const space = getWorkspaceFolder(uri);

	let diagnostics = []
	var parsedResponses: ErrorResponse[];
	try {
		parsedResponses = JSON.parse(response)
	} catch {
		return await findProblemsRaw(response, uri)
	}

	if (!JSON.parse(response).status) {
		for (let resp of parsedResponses) {
			if (resp.line == null)
				resp.line = 1
			if (resp.column == null)
				resp.column = 1
			if (resp.size == null)
				resp.size = 0
			const range = new Range(resp.line - 1, resp.column - 1, resp.line - 1, (resp.column + resp.size) - 1)
			const diagnostic = new Diagnostic(range, resp.message, DiagnosticSeverity.Error)
			var diag_uri = Uri.file(resp.file)
			if (!path.isAbsolute(resp.file)) {
				diag_uri = Uri.file(path.resolve(space.uri.fsPath, resp.file))
			}

			diagnostics.push([diag_uri, [diagnostic]])
		}
	}


	if (diagnostics.length == 0) {
		diagnosticCollection.clear()
	} else {
		diagnosticCollection.set(diagnostics)
	}
}

/**
 * Searches the rersponse for raw syntax errors.
 *
 * @export
 * @param {string} response output of the Crystal compiler * tools
 * @param {Uri} uri the file these errors correspond to
 * @return {*}  {Promise<void>}
 */
export async function findProblemsRaw(response: string, uri: Uri): Promise<void> {
	if (!response) return;

	const space = getWorkspaceFolder(uri);
	const responseData = response.match(/(?:.*)in '?(.*):(\d+):(\d+)'?:?([^]*)$/mi)

	let parsedLine = 0
	try {
		parsedLine = parseInt(responseData[1])
	} catch {
		diagnosticCollection.delete(uri)
		return;
	}

	let diagnostics = []
	if (parsedLine != 0) {
		const resp: ErrorResponse = {
			file: (uri && uri.fsPath) || responseData[1],
			line: parseInt(responseData[2]),
			column: parseInt(responseData[3]),
			size: null,
			message: responseData[4].trim()
		}

		const range = new Range(resp.line - 1, resp.column - 1, resp.line - 1, resp.column - 1)
		const diagnostic = new Diagnostic(range, resp.message, DiagnosticSeverity.Error)
		var diag_uri = Uri.file(resp.file)
		if (!path.isAbsolute(resp.file)) {
			diag_uri = Uri.file(path.resolve(space.uri.fsPath, resp.file))
		}

		diagnostics.push([diag_uri, [diagnostic]])
	}

	if (diagnostics.length == 0) {
		diagnosticCollection.clear()
	} else {
		diagnosticCollection.set(diagnostics)
	}
}

//

/**
 * Escape characters for passing to `exec`. Does not escape '*' as it's needed for some shard mainfiles.
 * Borrowed from https://taozhi.medium.com/escape-shell-command-in-nodejs-629ded063535.
 *
 * @export
 * @param {string} arg
 * @return {*}  {string}
 */
export function shellEscape(arg: string): string {
	if (/[^A-Za-z0-9_\/:=-]/.test(arg)) return arg.replace(/([$!'"();`?{}[\]<>&%#~@\\ ])/g, '\\$1')
	return arg
}

// Handle if the current file isn't in a workspace

/**
 * Wrapper for `workspace.getWorkspaceFolder` that returns the parent folder of the uri itself
 * if the file is not in a workspace folder.
 *
 * @export
 * @param {Uri} uri
 * @return {*}  {WorkspaceFolder}
 */
export function getWorkspaceFolder(uri: Uri): WorkspaceFolder {
	if (!uri) throw new Error("Undefined URI");

	const folder = workspace.getWorkspaceFolder(uri)
	if (folder) return folder;

	return {
		name: path.dirname(uri.fsPath),
		uri: Uri.file(path.dirname(uri.fsPath)),
		index: undefined
	}
}

/**
 * Uses `crystal tool dependencies` to find which target in the `shard.yml` corresponds to
 * the given file (if one exists).
 *
 * @export
 * @param {TextDocument} document
 * @return {*}  {Promise<string>}
 */
export async function getShardTargetForFile(document: TextDocument): Promise<{ response, error }> {
	const compiler = await getCompilerPath();
	const space = getWorkspaceFolder(document.uri);
	const targets = getShardYmlTargets(space);
	const config = workspace.getConfiguration('crystal-lang');

	if (!targets) return;

	for (const target of targets) {
		const targetPath = path.resolve(space.uri.fsPath, target)
		if (!existsSync(targetPath)) continue;

		const cmd = `${shellEscape(compiler)} tool dependencies ${shellEscape(targetPath)} -f flat --no-color ${config.get<string>("flags")}`
		crystalOutputChannel.appendLine(`[Dependencies] ${space.name} $ ${cmd}`)
		const targetDocument = await workspace.openTextDocument(Uri.parse(targetPath))

		const result = await execAsync(cmd, space.uri.fsPath)
			.then((resp) => {
				return { response: resp, error: undefined };
			})
			.catch((err) => {
				spawnProblemsTool(targetDocument, target);
				crystalOutputChannel.appendLine(`[Dependencies] error: ${err.stderr}`);
				return { response: undefined, error: err };
			})

		if (result.error) return { response: undefined, error: result.error };
		if (!result) continue;
		const dependencies = result.response.split(/\r?\n/)

		for (const line of dependencies) {
			if (path.resolve(space.uri.fsPath, line.trim()) == document.uri.fsPath) {
				return { response: path.resolve(space.uri.fsPath, target), error: undefined };
			}
		}
	}

	return { response: undefined, error: true };
}

/**
 * Gets the paths to each target in the `shard.yml` of a workspace.
 *
 * @param {WorkspaceFolder} space
 * @return {*}  {string[]}
 */
function getShardYmlTargets(space: WorkspaceFolder): string[] {
	const shardFile = getShardFile(space)

	if (existsSync(shardFile)) {
		const io = readFileSync(shardFile, 'utf8')
		const data = yaml.parse(io)

		if (data.targets !== undefined) {
			const values = Object.keys(data.targets).map(key => data.targets[key])
			return values.map(v => v.main)
		}
	}

	return []
}
