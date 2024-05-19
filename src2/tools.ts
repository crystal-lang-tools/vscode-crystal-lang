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
