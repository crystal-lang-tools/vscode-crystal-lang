import { ChildProcess, ExecException, exec } from "child_process";
import terminate from "terminate";
import { CancellationToken, Position, TextDocument, workspace } from "vscode";
import * as crypto from 'crypto';
import { readFile, readFileSync } from "fs";

import { outputChannel } from "./vscode";

function execWrapper(
  command: string,
  cwd: string,
  callback?: (
    error: (ExecException & { stdout: string; stderr: string }) | {},
    stdout: string,
    stderr: string
  ) => void
): ChildProcess {
  const disable_gc = workspace.getConfiguration('crystal-lang').get<boolean>('disable-gc', false);
  const env = { ...process.env }

  if (disable_gc) {
    env['GC_DONT_GC'] = '1'
  }

  const response = exec(command, { 'cwd': cwd, env }, (err, stdout, stderr) => {
    if (err) {
      callback({ ...err, stderr, stdout }, stdout, stderr);
      return;
    }

    callback(err, stdout, stderr);
  });

  return response;
}

// export const execAsync = promisify(execWrapper);
export async function execAsync(command: string, cwd: string, token: CancellationToken = undefined): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execWrapper(command, cwd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    })
    let childExited = false;

    child.on('exit', () => {
      childExited = true
    })

    token?.onCancellationRequested(() => {
      if (!childExited) {
        terminate(child.pid, () => {
          outputChannel.appendLine(`[Terminate] ${child.pid} stopped successfully`)
        })
      }
    })
  })
}

/**
 * Escape characters for passing to `exec`. Does not escape '*' as it's needed for some shard mainfiles.
 * Borrowed from https://taozhi.medium.com/escape-shell-command-in-nodejs-629ded063535.
 *
 * @export
 * @param {string} arg
 * @return {*}  {string}
 */
export function shellEscape(arg: string): string {
  if (arg === null || arg === undefined) return;
  if (/[^A-Za-z0-9_\/:=-]/.test(arg)) return arg.replace(/([$!'"();`?{}[\]<>&%#~@\\ ])/g, '\\$1')
  return arg
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
