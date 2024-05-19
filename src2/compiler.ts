import { existsSync } from "fs";
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, Uri, languages, workspace } from "vscode";
import path = require("path");

import { execAsync } from "./tools";
import { getWorkspaceFolder } from "./vscode";


export const diagnosticCollection: DiagnosticCollection = languages.createDiagnosticCollection("crystal")


export async function getCompilerPath(): Promise<string> {
  const config = workspace.getConfiguration('crystal-lang');

  if (config.has('compiler')) {
    const exe = config.get<string>('compiler');
    if (path.isAbsolute(exe) && existsSync(exe)) return Promise.resolve(exe);
  }

  const command =
    (process.platform === 'win32' ? 'where' : 'which') + ' crystal';

  return (await execAsync(command, process.cwd())).trim();
}

interface ErrorResponse {
  file: string
  line: number | null
  column: number | null
  size: number | null
  message: string
}

export async function findProblemsRaw(response: string, uri: Uri): Promise<void> {
  if (!response) return;

  const space = getWorkspaceFolder(uri);
  const responseData = response.match(/(?:.*)in '?(.*):(\d+):(\d+)'?:?([^]*)$/mi)

  let parsedLine = 0
  try {
    parsedLine = parseInt(responseData[1])
  } catch {
    diagnosticCollection.delete(uri)
    return;
  }

  let diagnostics = []
  if (parsedLine != 0) {
    const resp: ErrorResponse = {
      file: (uri && uri.fsPath) || responseData[1],
      line: parseInt(responseData[2]),
      column: parseInt(responseData[3]),
      size: null,
      message: responseData[4].trim()
    }

    const range = new Range(resp.line - 1, resp.column - 1, resp.line - 1, resp.column - 1)
    const diagnostic = new Diagnostic(range, resp.message, DiagnosticSeverity.Error)
    var diag_uri = Uri.file(resp.file)
    if (!path.isAbsolute(resp.file)) {
      diag_uri = Uri.file(path.resolve(space.uri.fsPath, resp.file))
    }

    diagnostics.push([diag_uri, [diagnostic]])
  }

  if (diagnostics.length == 0) {
    diagnosticCollection.clear()
  } else {
    diagnosticCollection.set(diagnostics)
  }
}
