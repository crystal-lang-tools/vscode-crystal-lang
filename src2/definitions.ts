import {
  CancellationToken, Definition, DefinitionProvider,
  Disposable, DocumentSelector, ExtensionContext,
  Location, LocationLink, Position,
  TextDocument, Uri, languages
} from "vscode";
import * as crypto from 'crypto';

import { getCursorPath, getProjectRoot, getConfig, outputChannel, getFlags } from "./vscode";
import { findProblems, getCompilerPath, getDocumentMainFiles } from "./compiler";
import { Cache, execAsync } from "./tools";
import path = require("path");

export function registerDefinitions(selector: DocumentSelector, context: ExtensionContext): Disposable {
  const disposable = languages.registerDefinitionProvider(
    selector, new CrystalDefinitionProvider()
  )

  context.subscriptions.push(disposable)

  return disposable;
}

class CrystalDefinitionProvider implements DefinitionProvider {
  private cache: Cache<Definition | LocationLink[]> = new Cache();

  async provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Definition | LocationLink[]> {
    const config = getConfig();
    if (!config.get<boolean>("definitions")) return;

    const hash = this.cache.computeHash(document, position);
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!
    }

    const line = document.lineAt(position.line);
    const requireMatches = /^\s*require\s+"(.+)"\s*$/.exec(line.text);
    if (requireMatches?.length > 1) return [];

    // Cannot run implementations tool on unsaved file
    if (document.isDirty) return;

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
  const config = getConfig();
  const cursor = getCursorPath(document, position);
  const mainFiles = await getDocumentMainFiles(document);
  const projectRoot = getProjectRoot(document.uri);

  if (!mainFiles || mainFiles.length == 0) return;

  const cmd = await getCompilerPath();
  const args = [
    'tool', 'implementations', '-c', cursor, ...mainFiles,
    '-f', 'json', '--no-color',
    ...getFlags(config)
  ]

  outputChannel.appendLine(`[Impl] (${projectRoot.name}) $ ${cmd} ${args.join(' ')}`);

  return execAsync(cmd, args, {
    cwd: projectRoot.uri.fsPath, token: token,
    cache_target: `crystal-${projectRoot.name}-${path.basename(mainFiles[0])}`
  })
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
    })
    .finally(() => outputChannel.appendLine(`[Impl] Done.`));
}
