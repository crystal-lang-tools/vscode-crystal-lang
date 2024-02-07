import { DecorationOptions, DecorationRangeBehavior, DocumentSelector, ExtensionContext, Position, Range, TextDocument, TextEditor, window, workspace } from "vscode";
import { compiler_mutex, crystalOutputChannel, execAsync, findProblems, getCompilerPath, getCursorPath, getShardMainPath, getWorkspaceFolder, setStatusBar, shellEscape } from "./tools";
import path = require("path");

export function registerUnreachable(
  selector: DocumentSelector,
  context: ExtensionContext) {
  workspace.onDidOpenTextDocument((e) => handleDocument(e), null, context.subscriptions)
  workspace.onDidSaveTextDocument((e) => handleDocument(e), null, context.subscriptions)
}

const decorationType = window.createTextEditorDecorationType({
  textDecoration: 'underline #aaaaaa',
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

interface UnreachableCode {
  name: string,
  location: string,
  lines: number,
  count: number
}

async function handleDocument(document: TextDocument) {
  if (document.uri && document.uri.scheme === "file" && (document.fileName.endsWith(".cr") || document.fileName.endsWith(".ecr"))) {
    if (compiler_mutex.isLocked()) return;

    const dispose = setStatusBar('finding unreachable code...');

    compiler_mutex.acquire()
      .then((release) => {
        spawnUnreachableTool(document)
          .then((values) => {
            if (!values || values.length == 0) {
              crystalOutputChannel.appendLine(`[Unreachable] No values returned`)
              return
            };
            decorate(document, values)
          })
          .catch((err) => {
            crystalOutputChannel.appendLine(`[Unreachable] Error: ${JSON.stringify(err)}`)
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

async function spawnUnreachableTool(document: TextDocument): Promise<UnreachableCode[]> {
  const compiler = await getCompilerPath();
  const config = workspace.getConfiguration('crystal-lang');
  // Spec files shouldn't have main set to something in src/
  // but are instead their own main files
  const main = await getShardMainPath(document);
  if (!main) return;

  const cmd = `${shellEscape(compiler)} tool unreachable ${shellEscape(main)} -f json --tallies --no-color ${config.get<string>("flags")}`
  const folder = getWorkspaceFolder(document.uri)

  crystalOutputChannel.appendLine(`[Unreachable] (${folder.name}) $ ${cmd}`);

  return await execAsync(cmd, folder.uri.fsPath)
    .then((response) => {
      return JSON.parse(response);
    }).catch((err) => {
      findProblems(err.stderr, document.uri);
      crystalOutputChannel.appendLine(`[Unreachable] error: ${err.stderr}`)
    })
}

async function decorate(document: TextDocument, values: UnreachableCode[]) {
  let decorationsArray: DecorationOptions[] = []
  let editor = window.activeTextEditor

  for (let value of values) {
    const location = value.location.split(":")
    const methodSize = value.name.split(/[#\.]/).pop().length

    const col = Number(location.pop()) - 1 + (value.name.includes("#") ? 4 : 9)
    const line = Number(location.pop()) - 1
    const filePath = location.join(":")
    const folder = getWorkspaceFolder(document.uri)

    if (path.resolve(folder.uri.fsPath, filePath) != editor.document.uri.fsPath) continue;


    const range = new Range(
      new Position(line, col),
      new Position(line, col + methodSize)
    )

    decorationsArray.push({ range, hoverMessage: `${value.count} usages` })
  }

  editor.setDecorations(decorationType, decorationsArray)
}
