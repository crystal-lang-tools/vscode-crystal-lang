import { TextDocument, workspace } from "vscode";
import { setStatusBar, compiler_mutex, crystalOutputChannel, diagnosticCollection, execAsync, findProblems, getCompilerPath, getShardMainPath, getWorkspaceFolder, shellEscape } from "./tools";
import path = require("path");

export function registerProblems(): void {
  workspace.onDidOpenTextDocument((e) => handleDocument(e))
  workspace.onDidSaveTextDocument((e) => handleDocument(e))

  return;
}

/**
 * Determines whether a document should have the problems tool run on it. If it should,
 * acquires the compiler mutex and executes the problems tool.
 *
 * @param {TextDocument} document
 * @return {*}  {Promise<void>}
 */
async function handleDocument(document: TextDocument): Promise<void> {
  if (document.uri && document.uri.scheme === "file" && (document.fileName.endsWith(".cr") || document.fileName.endsWith(".ecr"))) {
    if (compiler_mutex.isLocked()) return;

    const dispose = setStatusBar('finding problems...');

    compiler_mutex.acquire()
      .then((release) => {
        spawnProblemsTool(document)
          .catch((err) => {
            crystalOutputChannel.appendLine(`[Problems] Error: ${JSON.stringify(err)}`)
          })
          .finally(() => {
            release()
          })
      })
      .finally(() => {
        dispose()
      })
  }
}

export async function spawnProblemsTool(document: TextDocument, mainFile: string = undefined): Promise<void> {
  const compiler = await getCompilerPath();
  const main = mainFile || await getShardMainPath(document);
  if (!main) return;

  const folder = getWorkspaceFolder(document.uri);
  const config = workspace.getConfiguration('crystal-lang');

  // If document is in a folder of the same name as the document, it will throw an
  // error about not being able to use an output filename of '...' as it's a folder.
  // This is probably a bug as the --no-codegen flag is set, there is no output.
  //
  //    Error: can't use `...` as output filename because it's a directory
  //
  const output = process.platform === "win32" ? "nul" : "/dev/null"

  const cmd = `${shellEscape(compiler)} build ${shellEscape(main)} --no-debug --no-color --no-codegen --error-trace -f json -o ${output} ${config.get<string>("flags")}`

  crystalOutputChannel.appendLine(`[Problems] (${getWorkspaceFolder(document.uri).name}) $ ` + cmd)
  await execAsync(cmd, folder.uri.fsPath, `crystal-${folder.name}-${path.basename(main)}`)
    .then((response) => {
      diagnosticCollection.clear()
      crystalOutputChannel.appendLine("[Problems] No problems found.")
    }).catch((err) => {
      findProblems(err.stderr, document.uri)
      try {
        const parsed = JSON.parse(err.stderr)
        crystalOutputChannel.appendLine(`[Problems] Error: ${err.stderr}`)
      } catch {
        crystalOutputChannel.appendLine(`[Problems] Error: ${JSON.stringify(err)}`)
      }
    });
}
