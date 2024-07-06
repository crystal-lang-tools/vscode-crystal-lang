import { ChildProcess, ExecException, SpawnOptions, exec, spawn } from "child_process";
import terminate from "terminate";
import { CancellationToken, Position, TextDocument, workspace } from "vscode";
import * as crypto from 'crypto';
import { readFileSync } from "fs";

import { outputChannel } from "./vscode";

interface ExecOptions extends SpawnOptions {
  token?: CancellationToken | null
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

  computeHash(document: TextDocument, position: Position, disk: boolean = false): string {
    let content: string

    if (disk) {
      content = readFileSync(document.uri.fsPath).toString()
    } else {
      content = document.getText()
    }

    const hash = crypto.createHash('sha256');

    hash.update(content);

    if (position) {
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
