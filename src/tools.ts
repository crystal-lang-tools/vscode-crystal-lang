import { ChildProcess, exec, spawn } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Position, TextDocument, window, workspace } from 'vscode';
import * as yaml from 'yaml';

function execWrapper(
	command: string,
	callback?: (
		error: { stdout: string; stderr: string },
		stdout: string,
		stderr: string
	) => void
): ChildProcess {
	return exec(command, {}, (err, stdout, stderr) => {
		if (err) {
			callback({ stderr, stdout }, stdout, stderr);
			return;
		}
		callback({ stdout, stderr }, stdout, stderr);
	});
}

const execAsync = promisify(execWrapper);

export function setStatusBar(message: string): () => void {
	const bar = window.setStatusBarMessage(`Crystal: ${message} $(loading~spin)`);
	return () => bar.dispose();
}

function getCompilerPath(): Promise<string> {
	const config = workspace.getConfiguration('crystal-lang');

	if (config.has('compiler')) {
		const exe = config.get<string>('compiler');
		if (path.isAbsolute(exe) && existsSync(exe)) return Promise.resolve(exe);
	}

	const command =
		(process.platform === 'win32' ? 'where' : 'which') + ' crystal';
	console.debug(command);

	return execAsync(command);
}

// async function getShardsPath(): Promise<string>;

function getCursorPath(document: TextDocument, position: Position): string {
	return `${document.fileName}:${position.line + 1}:${position.character + 1}`;
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
	const dir = workspace.getWorkspaceFolder(document.uri).uri.fsPath;
	const fp = path.join(dir, 'shard.yml');

	if (existsSync(fp)) {
		const shard = <Shard>yaml.parse(fp);
		const main = shard.targets?.[shard.name]?.main;
		if (main) return path.resolve(dir, main);
	}

	return document.fileName;
}

export async function spawnFormatTool(document: TextDocument): Promise<string> {
	const compiler = await getCompilerPath();

	return await new Promise((res, rej) => {
		const child = spawn(compiler, ['tool', 'format', '--no-color', '-']);
		child.stdin.write(document.getText());
		child.stdin.end();

		const out: string[] = [];
		const err: string[] = [];

		child.stdout
			.setEncoding('utf-8')
			.on('data', d => out.push(d))
			.on('end', () => res(out.join()));

		child.stderr
			.setEncoding('utf-8')
			.on('data', d => err.push(d))
			.on('end', () => rej(err.join()));
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
			`${compiler} tool implementations -c ${cursor} ${main} -f json`
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
	position: Position
): Promise<ContextResponse> {
	const compiler = await getCompilerPath();
	const cursor = getCursorPath(document, position);
	const main = getShardMainPath(document);

	console.debug(`${compiler} tool context -c ${cursor} ${main} -f json`);

	return JSON.parse(
		await execAsync(`${compiler} tool context -c ${cursor} ${main} -f json`)
	);
}
