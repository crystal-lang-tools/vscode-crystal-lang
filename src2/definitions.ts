import { CancellationToken, Definition, DefinitionProvider, Disposable, DocumentSelector, ExtensionContext, Location, LocationLink, Position, Range, TextDocument, Uri, languages } from "vscode";
import path = require("path");
import * as crypto from 'crypto';
import { existsSync } from "fs";
import glob = require("glob");

import { getCursorPath, getProjectRoot, getConfig, outputChannel } from "./vscode";
import { findProblems, getCompilerPath, getPathToLibrary, getDocumentMainFile } from "./compiler";
import { execAsync, shellEscape } from "./tools";

export function registerDefinitions(selector: DocumentSelector, context: ExtensionContext): Disposable {
  const disposable = languages.registerDefinitionProvider(
    selector, new CrystalDefinitionProvider()
  )

  context.subscriptions.push(disposable)

  return disposable;
}

class CrystalDefinitionProvider implements DefinitionProvider {
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
    const config = getConfig();
    if (!config.get<boolean>("definitions")) return;

    const hash = this.computeHash(document, position);
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!
    }

    const line = document.lineAt(position.line);
    const projectRoot = getProjectRoot(document.uri);
    const requireMatches = /^\s*require\s+"(.+)"\s*$/.exec(line.text);

    if (requireMatches?.length > 1) {
      const textRange = document.getWordRangeAtPosition(position, /[^\"]+/)

      let text = requireMatches[1];
      outputChannel.appendLine(`[Implementations] Identified: ${text}`)

      if (text.includes('*')) {
        const list = glob.sync(text, { cwd: projectRoot.uri.fsPath, ignore: 'lib/**' })
        const items: LocationLink[] = []

        for (let item of list) {
          if (!item.endsWith(".cr"))
            continue;

          const itemPath = path.join(projectRoot.uri.fsPath, item)
          items.push({
            targetUri: Uri.file(itemPath),
            targetRange: new Range(new Position(0, 0), new Position(0, 0)),
            originSelectionRange: textRange
          })
        }

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

    outputChannel.appendLine('[Implementations] Getting implementations...')
    const result = await spawnImplTool(document, position, token)

    if (result === undefined || result.status !== 'ok') {
      outputChannel.appendLine(`[Implementations] No implementation found.`)
      this.cache.set(hash, [])
      return [];
    }

    const links: Location[] = []
    for (let impl of result.implementations!) {
      links.push(
        new Location(
          Uri.file(impl.filename),
          new Position(impl.line - 1, impl.column - 1)
        )
      );
    }

    if (links.length === 0) {
      outputChannel.appendLine(`[Implementations] No implementation found.`)
    }

    this.cache.set(hash, links)
    return links;
  }
}

interface ImplResponse {
  status: string;
  message: string;
  implementations?: {
    line: number;
    column: number;
    filename: string;
  }[];
}

async function spawnImplTool(
  document: TextDocument,
  position: Position,
  token: CancellationToken
): Promise<ImplResponse> {
  const compiler = await getCompilerPath();
  const config = getConfig();
  const cursor = getCursorPath(document, position);
  const mainFile = await getDocumentMainFile(document);
  const projectRoot = getProjectRoot(document.uri);

  if (!mainFile) return;

  const cmd = `${shellEscape(compiler)} tool implementations -c ${shellEscape(cursor)} ${shellEscape(mainFile)} -f json --no-color ${config.get<string>("flags")}`
  outputChannel.appendLine(`[Impl] (${projectRoot.name}) $ ${cmd}`);

  return execAsync(cmd, projectRoot.uri.fsPath, token)
    .then((response) => {
      return JSON.parse(response.stdout);
    })
    .catch((err) => {
      findProblems(err.stderr, document.uri);
      if (err?.signal === "SIGKILL") return;

      try {
        outputChannel.appendLine(`[Impl] Error: ${err.stderr}`)
      } catch {
        outputChannel.appendLine(`[Impl] Error: ${JSON.stringify(err)}`)
      }
    });
}
