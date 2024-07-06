import {
  CancellationToken, TextDocument, WorkspaceFolder
} from "vscode";

import { getConfig, getFlags, outputChannel, setStatusBar } from "./vscode";
import { diagnosticCollection, findProblems, getCompilerPath } from "./compiler";
import { execAsync } from "./tools";


export async function handleDocumentProblems(
  document: TextDocument, mainFiles: string[], projectRoot: WorkspaceFolder,
  token?: CancellationToken
): Promise<void> {
  if (document.uri === undefined || document.uri.scheme !== "file")
    return;

  const dispose = setStatusBar('finding problems...');

  return spawnProblemsTool(document, mainFiles, projectRoot, token)
    .finally(() => {
      dispose()
    })
}

export async function spawnProblemsTool(
  document: TextDocument, mainFiles: string[], projectRoot: WorkspaceFolder,
  token?: CancellationToken
): Promise<void> {
  const config = getConfig();
  const cmd = await getCompilerPath();

  if (!mainFiles || mainFiles.length == 0) {
    const err = `[Problems] Error: No main file set or found for ${document.fileName}`
    outputChannel.appendLine(err)
    return Promise.reject(err)
  }

  const output = process.platform === "win32" ? "nul" : "/dev/null"

  const args = [
    'build', ...mainFiles,
    '--no-debug', '--no-color', '--no-codegen', '--error-trace',
    '-f', 'json', '-o', output,
    ...getFlags(config)
  ]

  outputChannel.appendLine(`[Problems] (${projectRoot.name}) $ ${cmd} ${args.join(' ')}`)

  return execAsync(cmd, args, { cwd: projectRoot.uri.fsPath, token: token })
    .then(() => {
      diagnosticCollection.clear()
      outputChannel.appendLine("[Problems] No problems found.")
    })
    .catch((err) => {
      findProblems(err.stderr, document.uri);
      if (err?.signal === "SIGKILL") return;

      try {
        outputChannel.appendLine(`[Problems] Error: ${err.stderr}`)
      } catch {
        outputChannel.appendLine(`[Problems] Error: ${JSON.stringify(err)}`)
      }
    })
}
