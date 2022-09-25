import {
    window,
    workspace,
    Position,
    TextDocument
} from 'vscode';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export function setStatusBar(message: string): () => void {
    const bar = window.setStatusBarMessage(message);
    return () => bar.dispose();
}

async function getCompilerPath(): Promise<string> {
    const config = workspace.getConfiguration('crystal-lang');

    if (config.has('compiler')) {
        const exe = config.get<string>('compiler');
        if (path.isAbsolute(exe) && existsSync(exe)) return exe;
    }

    return new Promise((res, rej) => {
        const child = spawn(process.platform === 'win32' ? 'where' : 'which', ['crystal']);
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

// async function getShardsPath(): Promise<string>;

function getLocalPath(document: TextDocument): string {
    const dir = workspace.getWorkspaceFolder(document.uri).name;
    return path.join(dir, path.basename(document.fileName));
}

function getContextPath(document: TextDocument, position: Position): string {
    const path = getLocalPath(document);
    return `${path}:${position.line + 1}:${position.character + 1}`;
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
    const dir = workspace.getWorkspaceFolder(document.uri).name;
    const fp = path.join(dir, 'shard.yml');

    if (existsSync(fp)) {
        const shard = <Shard> yaml.parse(fp);
        const main = shard.targets?.[shard.name]?.main;
        if (main) return path.resolve(dir, main);
    }

    return getLocalPath(document);
}

export async function spawnFormatTool(document: TextDocument): Promise<string> {
    const compiler = await getCompilerPath();

    return new Promise((res, rej) => {
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
