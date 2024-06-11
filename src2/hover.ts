import {
  CancellationToken, Disposable,
  DocumentSelector, ExtensionContext, Hover,
  HoverProvider, MarkdownString, Position,
  TextDocument, TextLine, languages
} from "vscode";

import { getConfig, getCursorPath, getProjectRoot, outputChannel, setStatusBar } from "./vscode";
import { findProblems, getCompilerPath, getDocumentMainFile } from "./compiler";
import { Cache, execAsync, shellEscape } from "./tools";
import { keywords } from "./keywords";
import { wordPattern } from "./extension";


export function registerHover(
  selector: DocumentSelector,
  context: ExtensionContext
): Disposable {
  const disposable = languages.registerHoverProvider(selector, new CrystalHoverProvider())

  context.subscriptions.push(disposable)

  return disposable;
}


class CrystalHoverProvider implements HoverProvider {
  private cache: Cache<Hover> = new Cache();

  async provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Hover> {
    const config = getConfig();
    if (!config.get<boolean>("hover")) return;

    const hash = this.cache.computeHash(document, position);
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!
    }

    const line = document.lineAt(position.line);
    if (!line.text || /^#(?!{).+/.test(line.text)) return;
    if (/^\s*require\s+".*"\s*$/.test(line.text)) return;

    const wordRange = document.getWordRangeAtPosition(position, wordPattern)
    const text = document.getText(wordRange);
    if (keywords.includes(text)) return;

    const dispose = setStatusBar('running context tool...');
    outputChannel.appendLine(`[Hover] Getting context...`)

    return spawnContextTool(document, position, token)
      .then((response) => {
        const context = this.parseContext(response, line, text);

        this.cache.set(hash, context)

        return context
      })
      .finally(() => {
        dispose()
      })
  }

  parseContext(response: ContextResponse, line: TextLine, text: string): Hover {
    if (!response) return;
    if (!response.contexts) return;
    if (response.status !== 'ok') {
      outputChannel.appendLine(`[Hover] Failed: ${response?.message || JSON.stringify(response)}`)
      return;
    }

    outputChannel.appendLine(`[Hover] Context: ${response.message}`)
    outputChannel.appendLine(`[Hover] Context: ${JSON.stringify(response.contexts)}`)

    let contextKey = line.text;
    let context = response.contexts?.find(c => c[contextKey])

    let contextValue: string;

    if (context) {
      contextValue = context[contextKey]
    } else {
      contextKey = text
      context = response.contexts?.find(c => c[contextKey])
    }

    if (context) {
      contextValue = context[contextKey]
    } else {
      contextKey = text
      for (let ctx of response.contexts!) {
        const key = Object.keys(ctx).find(key => key.includes(contextKey));

        if (key) {
          context = ctx
          contextValue = ctx[key]
          break
        }
      }
    }

    if (!context || contextKey.includes("\n")) return;

    outputChannel.appendLine(`[Hover] Context: ${contextKey}: ${JSON.stringify(contextValue)}`)

    const mkdown = new MarkdownString().appendCodeblock(
      `${contextKey} : ${contextValue}`,
      'crystal'
    );
    return new Hover(mkdown);
  }
}


interface ContextResponse {
  status: string;
  message: string;
  contexts?: Record<string, string>[];
}

interface ContextError {
  file: string;
  line: number;
  column: number;
  message: string;
}

async function spawnContextTool(
  document: TextDocument,
  position: Position,
  token: CancellationToken
): Promise<ContextResponse> {
  const config = getConfig();
  const compiler = await getCompilerPath();
  const cursor = getCursorPath(document, position);
  const mainFile = await getDocumentMainFile(document);
  const projectRoot = getProjectRoot(document.uri);

  const cmd = `${shellEscape(compiler)} tool context -c ${shellEscape(cursor)} ${shellEscape(mainFile)} -f json --no-color  ${config.get<string>("flags")}`

  outputChannel.appendLine(`[Hover] (${projectRoot.name}) $ ${cmd}`)

  return await execAsync(cmd, projectRoot.uri.fsPath, token)
    .then((response) => {
      findProblems(response.stderr, document.uri);
      return JSON.parse(response.stdout);
    })
    .catch((err) => {
      outputChannel.appendLine(`[Hover] Error: ${JSON.stringify(err)}`)
    })
}
