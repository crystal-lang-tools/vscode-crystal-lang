import path = require("path");
import { Uri, WorkspaceFolder, window, workspace } from "vscode";


export const outputChannel = window.createOutputChannel("Crystal", "log")


export function setStatusBar(message: string): () => void {
  const bar = window.setStatusBarMessage(`Crystal: ${message} $(loading~spin)`);
  return () => bar.dispose();
}

export function getWorkspaceFolder(uri: Uri): WorkspaceFolder {
  if (!uri) throw new Error(`Undefined Uri: ${JSON.stringify(uri)}`)

  const folder = workspace.getWorkspaceFolder(uri);
  if (folder) return folder;

  return {
    name: path.dirname(uri.fsPath),
    uri: Uri.file(path.dirname(uri.fsPath)),
    index: undefined
  }
}
