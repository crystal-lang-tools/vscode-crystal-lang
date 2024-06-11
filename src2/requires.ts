import {
  CancellationToken, Definition, DefinitionProvider,
  Disposable, DocumentSelector, ExtensionContext,
  LocationLink, Position, Range,
  TextDocument, Uri, WorkspaceFolder, languages
} from "vscode";
import path = require("path");
import * as crypto from 'crypto';
import { existsSync } from "fs";
import glob = require("glob");

import { getProjectRoot } from "./vscode";
import { getPathToLibrary } from "./compiler";

export function registerRequireDefinitions(selector: DocumentSelector, context: ExtensionContext): Disposable {
  const disposable = languages.registerDefinitionProvider(
    selector, new CrystalRequireDefinitionProvider()
  )

  context.subscriptions.push(disposable)

  return disposable;
}

class CrystalRequireDefinitionProvider implements DefinitionProvider {
  private cache: Map<string, Definition | LocationLink[]> = new Map();

  private computeHash(document: TextDocument, position: Position): string {
    const wordRange = document.getWordRangeAtPosition(position);
    const wordStart = wordRange ? wordRange.start : position;
    const content = document.getText();
    const hash = crypto.createHash('sha256');

    hash.update(content);
    hash.update(wordStart.line.toString());
    hash.update(wordStart.character.toString());

    return hash.digest('hex');
  }

  async provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Definition | LocationLink[]> {
    const hash = this.computeHash(document, position);
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!
    }

    const line = document.lineAt(position.line);
    const projectRoot = getProjectRoot(document.uri);
    const requireMatches = /^\s*require\s+"(.+)"\s*$/.exec(line.text);

    if (requireMatches?.length < 2) {
      return [];
    }

    const textRange = document.getWordRangeAtPosition(position, /[^\"]+/)

    let text = requireMatches[1];

    if (text.includes('*')) {
      const items: LocationLink[] = await this.handleGlobRequires(text, document, projectRoot, textRange);

      return items;
    };

    const dir = path.dirname(document.fileName);
    if (/^\.{1,2}\/\w+/.test(text)) {
      if (!text.endsWith('.cr')) text += '.cr'

      const loc = path.join(dir, text);
      if (!existsSync(loc)) return [];

      const result: LocationLink[] = [{
        targetUri: Uri.file(loc),
        targetRange: new Range(new Position(0, 0), new Position(0, 0)),
        originSelectionRange: textRange
      }]
      this.cache.set(hash, result)
      return result;
    }

    // Search CRYSTAL_PATH for the library
    const libraryPath = await getPathToLibrary(text, projectRoot)
    if (libraryPath) {
      const result: LocationLink[] = [{
        targetUri: Uri.file(libraryPath),
        targetRange: new Range(new Position(0, 0), new Position(0, 0)),
        originSelectionRange: textRange
      }]
      this.cache.set(hash, result)
      return result
    }

    return [];
  }

  private async handleGlobRequires(text: string, document: TextDocument, projectRoot: WorkspaceFolder, textRange: Range) {
    let globDir: string;

    if (/^\.{1,2}\/\w+/.test(text)) {
      globDir = path.dirname(document.uri.fsPath);
    } else {
      const libraryName = text.split("/")[0];
      const libraryPath = await getPathToLibrary(libraryName, projectRoot);
      globDir = path.dirname(libraryPath);
    }

    let list = glob.sync(text, { cwd: globDir, ignore: 'lib/**' });

    const items: LocationLink[] = [];

    for (let item of list) {
      if (!item.endsWith(".cr"))
        continue;

      const itemPath = path.join(globDir, item);

      items.push({
        targetUri: Uri.file(itemPath),
        targetRange: new Range(new Position(0, 0), new Position(0, 0)),
        originSelectionRange: textRange
      });
    }
    return items;
  }
}
