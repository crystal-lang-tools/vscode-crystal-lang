import {
  CancellationToken, CompletionContext, CompletionItem,
  CompletionItemProvider, CompletionList, DocumentSelector,
  ExtensionContext, Position, TextDocument, languages, Disposable
} from "vscode";
import glob = require("glob");
import path = require("path");

import { getProjectRoot, outputChannel } from "./vscode";
import { getListOfLibraries } from "./compiler";


export function registerCompletion(
  selector: DocumentSelector,
  context: ExtensionContext
): Disposable {
  const disposable: Disposable = languages.registerCompletionItemProvider(
    selector,
    new CrystalCompletionItemProvider(),
    '"'
  )

  context.subscriptions.push(disposable);

  return disposable;
}

class CrystalCompletionItemProvider implements CompletionItemProvider {
  async provideCompletionItems(
    document: TextDocument, position: Position, token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList<CompletionItem>> {

    const line = document.lineAt(position.line);
    if (!line || /^\s*#\s*(?!{).+/.test(line.text)) return [];

    outputChannel.appendLine(`[Completion] Running...`)

    // `require` autocomplete
    if (/^\s*require\s+"(.*)"\s*$/.test(line.text)) {
      const items: CompletionItem[] = []

      const projectRoot = getProjectRoot(document.uri);
      const documentDir = path.dirname(document.fileName)
      const localFiles = glob.sync("./**/*.cr", {
        cwd: documentDir, ignore: 'lib/**'
      })

      for (let item of localFiles) {
        if (!item.endsWith(".cr"))
          continue;

        if (item === path.basename(document.fileName))
          continue;

        item = item.replace(".cr", "")

        items.push({
          label: "./" + item
        })
      }

      const libraries = await getListOfLibraries(projectRoot.uri);
      for (const lib of libraries) {
        items.push({
          label: lib
        })
      }

      outputChannel.appendLine(`[Completion] Success.`)
      return items;
    }

    return [];
  }
}
