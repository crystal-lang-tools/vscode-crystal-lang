import {
  CancellationToken, Diagnostic, DiagnosticCollection, DiagnosticSeverity, Position, Range, TextDocument,
  Uri, languages,
  window,
} from "vscode";
import path = require("path");

import { getConfig, getProjectRoot, outputChannel, setStatusBar, getFlags } from "./vscode";
import { getCompilerPath, getDocumentMainFiles } from "./compiler";
import { execAsync } from "./tools";


interface UnreachableCode {
  name: string,
  location: string,
  lines: number,
  count: number
}

const unreachableDiagnostics: DiagnosticCollection = languages.createDiagnosticCollection("crystal")

export async function handleDocumentUnreachable(document: TextDocument, token: CancellationToken) {
  const dispose = setStatusBar("finding unreachable code...")
  let editor = window.activeTextEditor

  return await spawnUnreachableTool(document, token)
    .then(values => {
      if (!values) return;

      let diagnostics: [Uri, Diagnostic[]][] = []

      for (const value of values) {
        if (value.count !== 0) continue;

        const location = value.location.split(":")
        const methodSize = value.name.split(/[#\.]/).pop().length

        let indent = 9

        if (value.name.includes("#") || value.name.match(/^::[a-z]+/)) {
          indent = 4
        }

        const col = Number(location.pop()) - 1 + indent
        const line = Number(location.pop()) - 1
        const filePath = location.join(":")
        const projectRoot = getProjectRoot(document.uri)

        const range = new Range(
          new Position(line, col),
          new Position(line, col + methodSize)
        )
        const diag = new Diagnostic(range, "Unused method - could have semantic errors", DiagnosticSeverity.Warning)

        diagnostics.push([
          Uri.file(path.resolve(projectRoot.uri.fsPath, filePath)),
          [diag]
        ])
      }

      unreachableDiagnostics.clear()
      unreachableDiagnostics.set(diagnostics)
    })
    .finally(() => dispose())
}


async function spawnUnreachableTool(
  document: TextDocument, token: CancellationToken
): Promise<UnreachableCode[]> {
  const config = getConfig();
  const mainFiles = await getDocumentMainFiles(document);
  const projectRoot = getProjectRoot(document.uri);

  const cmd = await getCompilerPath();
  const args = [
    'tool', 'unreachable', ...mainFiles,
    '-f', 'json', '--tallies', '--no-color',
    ...getFlags(config)
  ]

  outputChannel.appendLine(`[Unreachable] (${projectRoot.name}) $ ${cmd} ${args.join(' ')}`)

  return await execAsync(cmd, args, {
    cwd: projectRoot.uri.fsPath, token: token,
    cache_target: `crystal-${projectRoot.name}-${path.basename(mainFiles[0])}`
  })
    .then(response => {
      outputChannel.appendLine(JSON.stringify(response))

      return JSON.parse(response.stdout)
    })
    .catch((err) => {
      outputChannel.appendLine(`[Unreachable] Error: ${JSON.stringify(err)}`)
    })
    .finally(() => outputChannel.appendLine(`[Unreachable] (${projectRoot.name}) Done.`));
}
