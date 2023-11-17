import { ChildProcess, ExecException, ExecOptions, exec, spawn } from 'child_process';
import { existsSync, readFile } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Position, TextDocument, WorkspaceFolder, window, workspace } from 'vscode';
import * as yaml from 'yaml';
import * as junit2json from 'junit2json';
import { tmpdir } from 'os';

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

async function getCompilerPath(): Promise<string> {
	const config = workspace.getConfiguration('crystal-lang');

	if (config.has('compiler')) {
		const exe = config.get<string>('compiler');
		if (path.isAbsolute(exe) && existsSync(exe)) return Promise.resolve(exe);
	}

	const command =
		(process.platform === 'win32' ? 'where' : 'which') + ' crystal';

	return (await execAsync(command, process.cwd())).trim();
}

// async function getShardsPath(): Promise<string>;

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
	const dir = workspace.getWorkspaceFolder(document.uri).uri.fsPath;
	const fp = path.join(dir, 'shard.yml');

	if (existsSync(fp)) {
		const shard = yaml.parse(fp) as Shard;
		const main = shard.targets?.[shard.name]?.main;
		if (main) return path.resolve(dir, main);
	}

	if (config.has("main")) {
		return config.get<string>("main").replace("${workspaceRoot}", dir);
	}

	// https://github.com/crystal-lang/crystal/issues/13086
	// return document.fileName;
	if (/^\w:\\/.test(document.fileName)) return document.fileName.slice(2);
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
	const dir = workspace.getWorkspaceFolder(document.uri).uri.fsPath;
	const fp = path.join(dir, 'lib', name, 'shard.yml');
	console.debug(fp);
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
				rej(err.join());
				return;
			}
			res(out.join());
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

	console.debug(
		`${compiler} tool implementations -c ${cursor} ${main} -f json`
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
	const main = document.uri.path.includes('/spec/') ? document.uri.path : getShardMainPath(document);

	console.debug(`${compiler} tool context -c ${cursor} ${main} -f json`);

	return JSON.parse(
		await execAsync(
			`${compiler} tool context -c ${cursor} ${main} -f json`,
			workspace.getWorkspaceFolder(document.uri).uri.path
		),

	);
}

// Runs `crystal spec --junit temp_file`
export async function spawnSpecTool(
	workspace: WorkspaceFolder,
	dry_run: boolean = false,
	paths?: string[]
): Promise<junit2json.TestSuite> {
	// Get compiler stuff
	const compiler = await getCompilerPath();

	// create a tempfile
	// const tempFile = tempfile({ extension: "xml" });
	const tempFile = tmpdir() + path.sep + "output.xml"

	// execute crystal spec
	var cmd = `${compiler} spec --junit_output '${tempFile}'`;
	// Only valid for Crystal >= 1.11
	// if (dry_run) {
	// 	cmd += ` --dry-run`
	// }
	if (paths) {
		cmd += ` '${paths.join("' '")}'`
	}
	console.debug(cmd);

	await execAsync(cmd, workspace.uri.path)
		.catch((err) => {
			console.debug(JSON.stringify(err))
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
			resolve(output as junit2json.TestSuite);
		} catch (err) {
			reject(err)
		}
	})
}
