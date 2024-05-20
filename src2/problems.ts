import { TextDocument, WorkspaceFolder, workspace } from "vscode";
import { outputChannel, setStatusBar } from "./vscode";
import { diagnosticCollection, findProblems, getCompilerPath } from "./compiler";
import { execAsync, shellEscape } from "./tools";


export async function handleDocumentProblems(document: TextDocument, mainFile: string, projectRoot: WorkspaceFolder): Promise<void> {
  if (document.uri === undefined || document.uri.scheme !== "file")
    return;

  const dispose = setStatusBar('finding problems...');

  return spawnProblemsTool(document, mainFile, projectRoot)
    .finally(() => {
      dispose()
    })
}

export async function spawnProblemsTool(document: TextDocument, mainFile: string, projectRoot: WorkspaceFolder): Promise<void> {
  const config = workspace.getConfiguration('crystal-lang');
  const compiler = await getCompilerPath();

  if (!mainFile) {
    const err = `[Problems] Error: No main file set or found for ${document.fileName}`
    outputChannel.appendLine(err)
    return Promise.reject(err)
  }

  const output = process.platform === "win32" ? "nul" : "/dev/null"

  const cmd = `${shellEscape(compiler)} build ${shellEscape(mainFile)} --no-debug --no-color --no-codegen --error-trace -f json -o ${output} ${config.get<string>("flags")}`

  outputChannel.appendLine(`[Problems] (${projectRoot.name}) $ ${cmd}`)
  return execAsync(cmd, projectRoot.uri.fsPath)
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
