import { CancellationToken, Definition, DefinitionProvider, Disposable, DocumentSelector, ExtensionContext, Location, LocationLink, Position, TextDocument, Uri, languages, workspace } from "vscode";
import path = require("path");

import { getCursorPath, getProjectRoot, outputChannel } from "./vscode";
import { existsSync } from "fs";
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
  async provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Definition | LocationLink[]> {
    const config = workspace.getConfiguration('crystal-lang');
    if (!config.get<boolean>("definitions")) return;

    const line = document.lineAt(position.line);
    const requireMatches = /^require\s+"(.+)"\s*$/.exec(line.text);

    if (requireMatches?.length > 1) {
      let text = requireMatches[1];
      if (text.includes('*')) return [];

      outputChannel.appendLine(`[Impl] Identified: ${text}`)

      const dir = path.dirname(document.fileName);
      if (/^\.{1,2}\/\w+/.test(text)) {
        if (!text.endsWith('.cr')) text += '.cr'

        const loc = path.join(dir, text);
        if (!existsSync(loc)) return [];

        return new Location(Uri.file(loc), new Position(0, 0));
      }

      // TODO: implement shard lookup
      return [];
    }

    outputChannel.appendLine('[Impl] Getting implementations...')
    const result = await spawnImplTool(document, position, token);

    if (result === undefined || result.status !== 'ok') {
      outputChannel.appendLine(`[Impl] No implementation found.`)
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
  const config = workspace.getConfiguration('crystal-lang');
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
