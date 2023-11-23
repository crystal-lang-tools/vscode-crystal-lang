import { ChildProcess, ExecException, ExecOptions, exec, spawn } from 'child_process';
import { existsSync, readFile, readFileSync } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Position, TextDocument, WorkspaceFolder, window, workspace, Uri, languages, Range, Diagnostic, DiagnosticSeverity } from 'vscode';
import * as yaml from 'yaml';
import * as junit2json from 'junit2json';
import { tmpdir } from 'os';
import * as temp from 'temp';
import { cwd } from 'process';
import { doc } from 'prettier';

export const crystalOutputChannel = window.createOutputChannel("Crystal", "log")

function execWrapper(
	command: string,
	cwd: string,
	callback?: (
		error: (ExecException & { stdout: string; stderr: string }) | {},
		stdout: string,
		stderr: string
	) => void
): ChildProcess {
	return exec(command, { 'cwd': cwd }, (err, stdout, stderr) => {
		if (err) {
			callback({ ...err, stderr, stdout }, stdout, stderr);
			return;
		}

		callback(err, stdout, stderr);
	});
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
	return workspace.uri.path + path.sep + 'shard.yml'
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

function getShardMainPath(document: TextDocument): string {
	const config = workspace.getConfiguration('crystal-lang');
	const space = workspace.getWorkspaceFolder(document.uri);
	const dir = space.uri.fsPath;
	const fp = path.join(dir, 'shard.yml');

	// Specs are their own main files
	if (document.uri.path.includes('/spec/')) {
		return document.fileName;
	}

	// Pull a
	if (existsSync(fp)) {
		const shard_yml = readFileSync(fp, 'utf-8')
		const shard = yaml.parse(shard_yml) as Shard;
		var main = shard.targets?.[shard.name]?.main;
		if (main) return path.resolve(dir, main);
	}

	// https://github.com/crystal-lang/crystal/issues/13086
	// return document.fileName;
	if (/^\w:\\/.test(document.fileName)) return document.fileName.slice(2);

	// return document.fileName;
	// Splat all top-level files in source folder
	return space.uri.path + "/src/*.cr";
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
	const dir = workspace.getWorkspaceFolder(document.uri).uri.fsPath;
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
	const main = getShardMainPath(document);

	crystalOutputChannel.appendLine(
		`[Implementations] (${workspace.getWorkspaceFolder(document.uri).name}) $ ${compiler} tool implementations -c ${cursor} ${main} -f json`
	);

	return JSON.parse(
		await execAsync(
			`${compiler} tool implementations -c ${cursor} ${main} -f json`,
			workspace.getWorkspaceFolder(document.uri).uri.path
		)
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
	const main = getShardMainPath(document);

	crystalOutputChannel.appendLine(`[Context] (${workspace.getWorkspaceFolder(document.uri).name}) $ ${compiler} tool context -c ${cursor} ${main} -f json`);

	return await execAsync(
		`${compiler} tool context -c ${cursor} ${main} -f json`,
		workspace.getWorkspaceFolder(document.uri).uri.path
	).then((response) => {
		findProblems(response, document.uri);
		return JSON.parse(response);
	}).catch((err) => {
		findProblems(err.stderr, document.uri);
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
	testcase?: TestCase[]
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
): Promise<TestSuite> {
	// Get compiler stuff
	const compiler = await getCompilerPath();
	const compiler_version = await getCrystalVersion();

	// create a tempfile
	const tempFile = temp.path({ suffix: ".xml" })

	// execute crystal spec
	var cmd = `${compiler} spec --junit_output ${tempFile}`;
	// Only valid for Crystal >= 1.11
	if (dry_run && compiler_version.minor > 10) {
		cmd += ` --dry-run`
	}
	if (paths) {
		cmd += ` ${paths.join(" ")}`
	}
	crystalOutputChannel.appendLine(`[Spec] (${workspace.name}) $ ` + cmd);

	await execAsync(cmd, workspace.uri.path)
		.catch((err) => {
			if (err.stderr !== "") {
				crystalOutputChannel.appendLine(`[Spec] Error: ${JSON.stringify(err)}`)
			}
		});

	// read test results
	const results = await readSpecResults(tempFile);

	// parse junit
	return await parseJunit(results);
}

function readSpecResults(file: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		try {
			if (!existsSync(file)) {
				reject(new Error("Test results file doesn't exist"));
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

export async function spawnMacroExpandTool(document: TextDocument, position: Position) {
	const compiler = await getCompilerPath();
	const main = getShardMainPath(document);
	const cursor = getCursorPath(document, position);
	const folder = workspace.getWorkspaceFolder(document.uri).uri.path

	const cmd = `${compiler} tool expand ${main} --cursor ${cursor}`

	crystalOutputChannel.appendLine(`[Macro Expansion] (${workspace.getWorkspaceFolder(document.uri).name}) $ ` + cmd)
	return await execAsync(cmd, folder)
		.then((response) => {
			return response;
		})
		.catch(async (err) => {
			const new_cmd = cmd + ' -f json'
			await execAsync(new_cmd, folder)
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
	const cmd = `${compiler} --version`
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
	const parsedResponses = JSON.parse(response) as ErrorResponse[]

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
			diagnostics.push([uri, [diagnostic]])
		}
	}


	if (diagnostics.length == 0) {
		diagnosticCollection.clear()
	} else {
		diagnosticCollection.set(diagnostics)
	}
}

export async function findProblemsRaw(response: string, uri: Uri): Promise<void> {
	let diagnostics = []
	const responseData = response.match(/.* in .*?(\d+):\S* (.*)/)

	let parsedLine = 0
	try {
		parsedLine = parseInt(responseData[1])
	} catch { }

	const parsedColumn = 1

	if (parsedLine != 0) {
		const resp: ErrorResponse = {
			file: uri.path,
			line: parsedLine,
			column: parsedColumn,
			size: null,
			message: responseData[2]
		}

		const range = new Range(resp.line - 1, resp.column - 1, resp.line - 1, resp.column - 1)
		const diagnostic = new Diagnostic(range, resp.message, DiagnosticSeverity.Error)
		diagnostics.push([uri, [diagnostic]])
	}

	if (diagnostics.length == 0) {
		diagnosticCollection.clear()
	} else {
		diagnosticCollection.set(diagnostics)
	}
}
