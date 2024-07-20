import {
  CancellationToken, Disposable, DocumentSelector,
  ExtensionContext, Hover, HoverProvider,
  languages, MarkdownString, Position, ProviderResult,
  TextDocument
} from "vscode";
import { findProblems, getCompilerPath, getDocumentMainFiles } from "./compiler";
import { getConfig, getCursorPath, getFlags, getProjectRoot, outputChannel } from "./vscode";
import { Cache, execAsync } from "./tools";

export function registerMacroHover(
  selector: DocumentSelector,
  context: ExtensionContext
): Disposable {
  const disposable = languages.registerHoverProvider(selector, new CrystalMacroHoverProvider())

  context.subscriptions.push(disposable)

  return disposable;
}

class CrystalMacroHoverProvider implements HoverProvider {
  private cache: Cache<Hover> = new Cache();

  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Hover> {
    const config = getConfig();
    if (!config.get<boolean>("macro-hover")) return;

    const hash = this.cache.computeHash(document, position);
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!
    }

    outputChannel.appendLine(`[Macro Expansion] Getting expansion...`)

    return spawnMacroExpandTool(document, position, token)
      .then((response) => {
        if (!response) return;

        if (!response.includes("no expansion found")) {
          const contents = new MarkdownString(`\`\`\`crystal\n${response}\`\`\``)
          const hover = new Hover(contents)

          this.cache.set(hash, hover)

          return hover;
        } else {
          this.cache.set(hash, null)
        }
      })
      .finally(() => {
        outputChannel.appendLine(`[Macro Expansion] Done.`)
      })
  }

}

export async function spawnMacroExpandTool(document: TextDocument, position: Position, token: CancellationToken): Promise<string | void> {
  const mainFiles = await getDocumentMainFiles(document);
  if (!mainFiles || mainFiles.length === 0) return;

  const cursor = getCursorPath(document, position);
  const folder = getProjectRoot(document.uri);
  const config = getConfig();

  const cmd = await getCompilerPath();
  const args = [
    'tool', 'expand', '-c', cursor, ...mainFiles,
    '--no-color', ...getFlags(config)
  ]

  outputChannel.appendLine(`[Macro Expansion] (${folder.name}) $ ${cmd} ${args.join(' ')}`)

  return await execAsync(cmd, args, { cwd: folder.uri.fsPath, token: token })
    .then((response) => {
      if (response.stdout.length === 0) {
        outputChannel.appendLine(`[Macro Expansion] Error: ${response.stderr}`)
        return;
      }

      findProblems(response.stderr, document.uri);

      return response.stdout;
    })
    .catch((err) => {
      outputChannel.appendLine(`[Macro Expansion] Error: ${err?.message || JSON.stringify(err)}`)
    });
}
