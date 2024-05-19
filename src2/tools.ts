import { ChildProcess, ExecException, exec } from "child_process";
import { promisify } from "util";
import { workspace } from "vscode";


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

export const execAsync = promisify(execWrapper);

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
