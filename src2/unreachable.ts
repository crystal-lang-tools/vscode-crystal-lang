import {
  CancellationToken, DecorationOptions, DecorationRangeBehavior,
  Position, Range, TextDocument,
  window
} from "vscode";
import path = require("path");

import { getConfig, getProjectRoot, outputChannel, setStatusBar } from "./vscode";
import { getCompilerPath, getDocumentMainFile } from "./compiler";
import { execAsync, shellEscape } from "./tools";


interface UnreachableCode {
  name: string,
  location: string,
  lines: number,
  count: number
}

const decorationType = window.createTextEditorDecorationType({
  isWholeLine: true,
  rangeBehavior: DecorationRangeBehavior.OpenOpen,
  after: {
    margin: '0 0 0 1em',
    color: '#999',
    fontStyle: 'italic',
  }
});


export async function handleDocumentUnreachable(document: TextDocument, token: CancellationToken) {
  const dispose = setStatusBar("finding unreachable code...")

  return await spawnUnreachableTool(document, token)
    .then(values => decorate(document, values))
    .finally(() => dispose())
}


async function spawnUnreachableTool(
  document: TextDocument, token: CancellationToken
): Promise<UnreachableCode[]> {
  const config = getConfig();
  const compiler = await getCompilerPath();
  const mainFile = await getDocumentMainFile(document);
  const projectRoot = getProjectRoot(document.uri);

  const cmd = `${shellEscape(compiler)} tool unreachable ${shellEscape(mainFile)} -f json --tallies --no-color ${config.get<string>("flags")}`

  outputChannel.appendLine(`[Unreachable] (${projectRoot.name}) $ ${cmd}`)

  return await execAsync(cmd, projectRoot.uri.fsPath, token)
    .then(response => JSON.parse(response.stdout));
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
    const projectRoot = getProjectRoot(document.uri)

    if (path.resolve(projectRoot.uri.fsPath, filePath) != editor.document.uri.fsPath) continue;


    const range = new Range(
      new Position(line, col),
      new Position(line, col + methodSize)
    )

    const decoration = {
      range: range,
      renderOptions: {
        after: {
          contentText: `# ${value.count} usages`
        }
      }
    }

    decorationsArray.push(decoration)
  }

  editor.setDecorations(decorationType, decorationsArray)
}
