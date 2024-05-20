import { existsSync } from "fs";
import { Position, TextDocument, Uri, WorkspaceFolder, window } from "vscode";
import path = require("path");


export const outputChannel = window.createOutputChannel("Crystal", "log")


export function setStatusBar(message: string): () => void {
  const bar = window.setStatusBarMessage(`Crystal: ${message} $(loading~spin)`);
  return () => bar.dispose();
}

export function getProjectRoot(uri: Uri): WorkspaceFolder {
  if (!uri) throw new Error(`Undefined Uri`)

  const result = findClosestShardYml(uri);

  if (result) {
    return {
      name: result.fsPath,
      uri: result,
      index: undefined
    }
  } else {
    return {
      name: path.dirname(uri.fsPath),
      uri: Uri.file(path.dirname(uri.fsPath)),
      index: undefined
    }
  }
}

function findClosestShardYml(uri: Uri): Uri | null {
  let currentDir = path.dirname(uri.fsPath);

  while (currentDir !== path.parse(currentDir).root) {
    const shardYmlPath = path.join(currentDir, 'shard.yml');
    if (existsSync(shardYmlPath)) {
      return Uri.file(currentDir);
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Returns the position of a cursor in a file in the form `/path/to/file:line:col`
 * for use by Crystal compiler tools.
 *
 * @export
 * @param {TextDocument} document
 * @param {Position} position
 * @return {*}  {string}
 */
export function getCursorPath(document: TextDocument, position: Position): string {
  // https://github.com/crystal-lang/crystal/issues/13086
  // return `${document.fileName}:${position.line + 1}:${position.character + 1}`;
  const path = `${document.fileName}:${position.line + 1}:${position.character + 1
    }`;
  if (/^\w:\\/.test(path)) return path.slice(2);
  return path;
}
