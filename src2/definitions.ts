import {
  CancellationToken, Definition, DefinitionProvider,
  Disposable, DocumentSelector, ExtensionContext,
  Location, LocationLink, Position,
  TextDocument, Uri, languages
} from "vscode";
import * as crypto from 'crypto';

import { getCursorPath, getProjectRoot, getConfig, outputChannel } from "./vscode";
import { findProblems, getCompilerPath, getDocumentMainFile } from "./compiler";
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
    const requireMatches = /^\s*require\s+"(.+)"\s*$/.exec(line.text);
    if (requireMatches?.length > 1) return [];

    outputChannel.appendLine('[Impl] Getting implementations...')
    const result = await spawnImplTool(document, position, token)

    if (result === undefined || result.status !== 'ok') {
      outputChannel.appendLine(`[Impl] No implementation found.`)
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
      outputChannel.appendLine(`[Impl] No implementation found.`)
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
