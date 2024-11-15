import { ChildProcess, ExecException, SpawnOptions, exec, spawn } from "child_process";
import terminate from "terminate";
import { CancellationToken, Position, TextDocument, TextDocumentChangeReason, workspace } from "vscode";
import * as crypto from 'crypto';
import { readFileSync, statSync } from "fs";
import { homedir } from "os";
import path = require("path");

import { outputChannel } from "./vscode";
import { TextDocumentContents } from "./symbols";

interface ExecOptions extends SpawnOptions {
  token?: CancellationToken | null,
  cache_target?: string | null
}

interface ExecResponse {
  stdout: string,
  stderr: string
}

export async function execAsync(cmd: string, args: string[], options: ExecOptions | null = null): Promise<ExecResponse> {
  const disable_gc = workspace.getConfiguration('crystal-lang').get<boolean>('disable-gc', false);

  if (disable_gc) {
    options = {
      ...options,
      env: {
        ...process.env,
        ...options?.env,
        'GC_DONT_GC': '1'
      }
    };
  }

  if (options?.cache_target) {
    // Don't want to interfere with the global cache
    const cache_dir = process.env['XDG_CACHE_HOME'] ||
      (homedir() ? path.join(homedir(), '.cache') : undefined) ||
      path.join(options.cwd.toString(), '.crystal');

    options = {
      ...options,
      env: {
        ...process.env,
        ...options?.env,
        'CRYSTAL_CACHE_DIR': path.join(
          cache_dir,
          options.cache_target
            .replace('/', '-')
            .replace('\\', '-')
        )
      }
    };
  }

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, options)
    let childExited = false
    const stdout: string[] = []
    const stderr: string[] = []

    child.stdout.on('data', (data) => {
      stdout.push(data.toString())
    })

    child.stderr.on('data', (data) => {
      stderr.push(data.toString())
    })

    child.on('error', (err) => {
      childExited = true
      outputChannel.appendLine(`[Crystal] Failed to execute \`${cmd} ${args.join(' ')}\`: ${err.name} - ${err.message}`)
      reject(err)
    })

    child.on('close', (code, signal) => {
      if (code > 0 || signal) {
        reject({
          code: code,
          signal: signal,
          stdout: stdout.join(''),
          stderr: stderr.join('')
        })
      } else {
        resolve({
          stdout: stdout.join(''),
          stderr: stderr.join('')
        });
      }
    })

    child.on('exit', (code, signal) => {
      childExited = true
    })

    options.token?.onCancellationRequested(() => {
      if (!childExited) {
        terminate(
          child.pid,
          () => outputChannel.appendLine(`[Terminate] ${child.pid} stopped successfully`)
        )
      }
    })
  })
}

export class Cache<T> {
  private cache: Map<string, T> = new Map()

  computeHash(document: TextDocument | TextDocumentContents, position: Position, disk: boolean = false): string {
    let content: string

    if (disk) {
      content = readFileSync(document.uri.fsPath).toString()
    } else {
      content = document.getText()
    }

    const hash = crypto.createHash('sha256');

    hash.update(content);

    if (position && 'getWordRangeAtPosition' in document) {
      const wordRange = document.getWordRangeAtPosition(position);
      const wordStart = wordRange ? wordRange.start : position;
      hash.update(wordStart.line.toString());
      hash.update(wordStart.character.toString());
    }

    return hash.digest('hex');
  }

  has(hash: string) {
    return this.cache.has(hash)
  }

  get(hash: string) {
    return this.cache.get(hash)
  }

  set(hash: string, value: T) {
    return this.cache.set(hash, value)
  }
}

export class MtimeCache<T> {
  private cache: Map<string, { mtime: number, data: T }> = new Map();

  computeMtimeHash(filePath: string): number {
    const stats = statSync(filePath);
    return stats.mtimeMs; // Use mtimeMs for millisecond precision
  }

  has(filePath: string, mtime: number): boolean {
    const cached = this.cache.get(filePath);
    return cached !== undefined && cached.mtime === mtime;
  }

  get(filePath: string): T | undefined {
    const cached = this.cache.get(filePath);
    return cached?.data;
  }

  set(filePath: string, mtime: number, value: T): void {
    this.cache.set(filePath, { mtime, data: value });
  }
}
