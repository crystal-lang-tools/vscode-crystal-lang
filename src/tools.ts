import { ChildProcess, ExecException, exec, spawn } from 'child_process';
import { existsSync, readFile, readFileSync } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Position, TextDocument, WorkspaceFolder, window, workspace, Uri, languages, Range, Diagnostic, DiagnosticSeverity } from 'vscode';
import * as yaml from 'yaml';
import * as junit2json from 'junit2json';
import * as temp from 'temp';
import { cwd } from 'process';
import { Mutex } from 'async-mutex';

export const crystalOutputChannel = window.createOutputChannel("Crystal", "log")

export const compiler_mutex: Mutex = new Mutex();

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

const execAsync = promisify(execWrapper);

export function setStatusBar(message: string): () => void {
	const bar = window.setStatusBarMessage(`Crystal: ${message} $(loading~spin)`);
	return () => bar.dispose();
}

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

	const defaultMainFile = workspace.getConfiguration('crystal-lang', folder.uri).get<string>('mainFile', 'main.cr')
	return defaultMainFile
}

function getShardFile(workspace: WorkspaceFolder): string {
	return workspace.uri.fsPath + path.sep + 'shard.yml'
}

function getCursorPath(document: TextDocument, position: Position): string {
	// https://github.com/crystal-lang/crystal/issues/13086
	// return `${document.fileName}:${position.line + 1}:${position.character + 1}`;
	const path = `${document.fileName}:${position.line + 1}:${position.character + 1
		}`;
	if (/^\w:\\/.test(path)) return path.slice(2);
	return path;
}

interface Dependency {
	git?: string;
	github?: string;
	gitlab: string;
	branch?: string;
	version?: string;
}

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
async function getShardMainPath(document: TextDocument): Promise<string> {
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
		if (shardTarget) return shardTarget;
	}

	// If this is a crystal project
	if (existsSync(fp)) {
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

export async function getCrystalLibPath(): Promise<string> {
	const compiler = await getCompilerPath();
	const libpath = await execAsync(`${compiler} env CRYSTAL_PATH`, process.cwd());

	return libpath.replace(/^lib[:;]|(?:\r)?\n/g, '');
}

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

export async function spawnFormatTool(document: TextDocument): Promise<string> {
	const compiler = await getCompilerPath();

	return await new Promise((res, rej) => {
		const child = spawn(
			compiler,
			['tool', 'format', '--no-color', '-'],
			{ shell: process.platform == "win32" }
		);

		child.stdin.write(document.getText());
		child.stdin.end();

		const out: string[] = [];
		const err: string[] = [];

		child.stdout
			.setEncoding('utf-8')
			.on('data', d => out.push(d));

		child.stderr
			.setEncoding('utf-8')
			.on('data', d => err.push(d));

		child.on('close', () => {
			if (err.length > 0) {
				const err_resp = err.join()
				findProblemsRaw(err_resp, document.uri)
				rej(err_resp);
				return;
			}
			const out_resp = out.join()
			findProblemsRaw(out_resp, document.uri)
			res(out_resp);
		})
	});
}

export interface ImplResponse {
	status: string;
	message: string;
	implementations?: {
		line: number;
		column: number;
		filename: string;
	}[];
}

export async function spawnImplTool(
	document: TextDocument,
	position: Position
): Promise<ImplResponse> {
	const compiler = await getCompilerPath();
	const cursor = getCursorPath(document, position);
	const main = await getShardMainPath(document);
	const cmd = `${shellEscape(compiler)} tool implementations -c ${shellEscape(cursor)} ${shellEscape(main)} -f json --no-color`
	const folder: WorkspaceFolder = getWorkspaceFolder(document.uri)

	crystalOutputChannel.appendLine(`[Implementations] (${folder.name}) $ ${cmd}`);

	return JSON.parse(
		await execAsync(cmd, folder.uri.fsPath)
	);
}

interface ContextResponse {
	status: string;
	message: string;
	contexts?: Record<string, string>[];
}

export interface ContextError {
	file: string;
	line: number;
	column: number;
	message: string;
}

export async function spawnContextTool(
	document: TextDocument,
	position: Position,
	dry_run: boolean = false
): Promise<ContextResponse> {
	const compiler = await getCompilerPath();
	const cursor = getCursorPath(document, position);
	// Spec files shouldn't have main set to something in src/
	// but are instead their own main files
	const main = await getShardMainPath(document);
	const cmd = `${shellEscape(compiler)} tool context -c ${shellEscape(cursor)} ${shellEscape(main)} -f json --no-color`
	const folder = getWorkspaceFolder(document.uri)

	crystalOutputChannel.appendLine(`[Context] (${folder.name}) $ ${cmd}`);

	return await execAsync(cmd, folder.uri.fsPath)
		.then((response) => {
			findProblems(response, document.uri);
			return JSON.parse(response);
		}).catch((err) => {
			findProblems(err.stderr, document.uri);
			crystalOutputChannel.appendLine(`[Context] error: ${err.stderr}`)
		})
}

export type TestSuite = junit2json.TestSuite & {
	tests?: number;
	skipped?: number;
	errors?: number;
	failures?: number;
	time?: number;
	timestamp?: string;
	hostname?: string;
	testcase?: TestCase[];
}

export type TestCase = junit2json.TestCase & {
	file?: string;
	classname?: string;
	name?: string;
	line?: number;
	time?: number;
}

// Runs `crystal spec --junit temp_file`
export async function spawnSpecTool(
	workspace: WorkspaceFolder,
	dry_run: boolean = false,
	paths?: string[]
): Promise<TestSuite | void> {
	// Get compiler stuff
	const compiler = await getCompilerPath();
	const compiler_version = await getCrystalVersion();

	// create a tempfile
	const tempFile = temp.path({ suffix: ".xml" })

	// execute crystal spec
	var cmd = `${shellEscape(compiler)} spec --junit_output ${shellEscape(tempFile)} --no-color`;
	// Only valid for Crystal >= 1.11
	if (dry_run && compiler_version.minor > 10) {
		cmd += ` --dry-run`
	}
	if (paths) {
		cmd += ` ${paths.map((i) => shellEscape(i)).join(" ")}`
	}
	crystalOutputChannel.appendLine(`[Spec] (${workspace.name}) $ ` + cmd);

	await execAsync(cmd, workspace.uri.fsPath).catch((err) => {
		if (err.stderr) {
			findProblems(err.stderr, undefined)
		} else if (err.message) {
			crystalOutputChannel.appendLine(`[Spec] Error: ${err.message}`)
		} else {
			crystalOutputChannel.appendLine(`[Spec] Error: ${err.stdout}`)
		}
	});

	return readSpecResults(tempFile).then(async (results) => {
		return parseJunit(results);
	}).catch((err) => {
		if (err.message) {
			crystalOutputChannel.appendLine(`[Spec] Error: ${err.message}`)
		} else {
			crystalOutputChannel.appendLine(`[Spec] Error: ${JSON.stringify(err)}`)
		}
	});
}

function readSpecResults(file: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		try {
			if (!existsSync(file)) {
				reject(new Error("Test results file doesn't exist"));
				return;
			}

			readFile(file, (error, data) => {
				if (error) {
					reject(new Error("Error reading test results file: " + error.message));
				} else {
					resolve(data);
				}
			})
		} catch (err) {
			reject(err);
		}
	})
}

function parseJunit(rawXml: Buffer): Promise<junit2json.TestSuite> {
	return new Promise(async (resolve, reject) => {
		try {
			const output = await junit2json.parse(rawXml);
			resolve(output as TestSuite);
		} catch (err) {
			reject(err)
		}
	})
}

export async function spawnMacroExpandTool(document: TextDocument, position: Position): Promise<string | void> {
	const compiler = await getCompilerPath();
	const main = await getShardMainPath(document);
	const cursor = getCursorPath(document, position);
	const folder = getWorkspaceFolder(document.uri);

	const cmd = `${shellEscape(compiler)} tool expand ${shellEscape(main)} --cursor ${shellEscape(cursor)}`

	crystalOutputChannel.appendLine(`[Macro Expansion] (${folder.name}) $ ` + cmd)
	return await execAsync(cmd, folder.uri.fsPath)
		.then((response) => {
			return response;
		})
		.catch(async (err) => {
			const new_cmd = cmd + ' -f json'
			await execAsync(new_cmd, folder.uri.fsPath)
				.catch((err) => {
					findProblems(err.stderr, document.uri)
					crystalOutputChannel.appendLine(`[Macro Expansion] Error: ${err.message}`)
				})
		});
}

interface SemVer {
	major: number,
	minor: number,
	patch: number
}

async function getCrystalVersion(): Promise<SemVer> {
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

interface ErrorResponse {
	file: string
	line: number | null
	column: number | null
	size: number | null
	message: string
}

export async function findProblems(response: string, uri: Uri): Promise<void> {
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
			diagnostics.push([Uri.file(resp.file), [diagnostic]])
		}
	}


	if (diagnostics.length == 0) {
		diagnosticCollection.clear()
	} else {
		diagnosticCollection.set(diagnostics)
	}
}

export async function findProblemsRaw(response: string, uri: Uri): Promise<void> {
	if (response === undefined) return;

	const responseData = response.match(/(?:.*)in '?(.*):(\d+):(\d+)'?:?([^]*)$/mi)

	let parsedLine = 0
	try {
		parsedLine = parseInt(responseData[1])
	} catch {
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
		diagnostics.push([Uri.file(resp.file), [diagnostic]])
	}

	if (diagnostics.length == 0) {
		diagnosticCollection.clear()
	} else {
		diagnosticCollection.set(diagnostics)
	}
}

export async function spawnProblemsTool(document: TextDocument): Promise<void> {
	const compiler = await getCompilerPath();
	const main = await getShardMainPath(document);
	const folder = getWorkspaceFolder(document.uri).uri.fsPath
	// If document is in a folder of the same name as the document, it will throw an
	// error about not being able to use an output filename of '...' as it's a folder.
	// This is probably a bug as the --no-codegen flag is set, there is no output.
	//
	//    Error: can't use `...` as output filename because it's a directory
	//
	const output = process.platform === "win32" ? "nul" : "/dev/null"

	const cmd = `${shellEscape(compiler)} build ${shellEscape(main)} --no-debug --no-color --no-codegen --error-trace -f json -o ${output}`

	crystalOutputChannel.appendLine(`[Problems] (${getWorkspaceFolder(document.uri).name}) $ ` + cmd)
	await execAsync(cmd, folder)
		.then((response) => {
			diagnosticCollection.clear()
			crystalOutputChannel.appendLine("[Problems] No problems found.")
		}).catch((err) => {
			findProblems(err.stderr, document.uri)
			try {
				const parsed = JSON.parse(err.stderr)
				crystalOutputChannel.appendLine(`[Problems] Error: ${parsed}`)
			} catch {
				crystalOutputChannel.appendLine(`[Problems] Error: ${JSON.stringify(err)}`)
			}
		});
}

// Borrowed from https://taozhi.medium.com/escape-shell-command-in-nodejs-629ded063535.
// Does not escape '*' as it's needed for some shard mainfiles.
function shellEscape(arg: string): string {
	if (/[^A-Za-z0-9_\/:=-]/.test(arg)) return arg.replace(/([$!'"();`?{}[\]<>&%#~@\\ ])/g, '\\$1')
	return arg
}

// Handle if the current file isn't in a workspace
export function getWorkspaceFolder(uri: Uri): WorkspaceFolder {
	const folder = workspace.getWorkspaceFolder(uri)
	if (folder) return folder;

	return {
		name: path.dirname(uri.fsPath),
		uri: Uri.file(path.dirname(uri.fsPath)),
		index: undefined
	}
}

export async function getShardTargetForFile(document: TextDocument): Promise<string> {
	const compiler = await getCompilerPath();
	const space = getWorkspaceFolder(document.uri);
	const targets = getShardYmlTargets(space);

	if (!targets) return;

	for (const target of targets) {
		const targetPath = path.resolve(space.uri.fsPath, target)
		if (!existsSync(targetPath)) continue;

		const cmd = `${shellEscape(compiler)} tool dependencies ${shellEscape(targetPath)} -f flat --no-color`
		crystalOutputChannel.appendLine(`[Dependencies] ${space.name} $ ${cmd}`)

		const response = await execAsync(cmd, space.uri.fsPath)
			.catch((err) => {
				findProblems(err, document.uri);
				crystalOutputChannel.appendLine(`[Dependencies] error: ${JSON.stringify(err)}`);
			})

		if (!response) continue;
		const dependencies = response.split(/\r?\n/)

		for (const line of dependencies) {
			if (path.resolve(space.uri.fsPath, line) == document.uri.fsPath) {
				return path.resolve(space.uri.fsPath, line);
			}
		}
	}

	return
}

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
