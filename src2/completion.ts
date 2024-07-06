import {
  CancellationToken, CompletionContext, CompletionItem,
  CompletionItemProvider, CompletionList, DocumentSelector,
  ExtensionContext, Position, TextDocument, languages, Disposable,
  ProviderResult, Range
} from "vscode";
import glob = require("glob");
import path = require("path");

import { getConfig, getFlags, getProjectRoot, outputChannel } from "./vscode";
import { findProblems, getCompilerPath, getDocumentMainFiles, getListOfLibraries } from "./compiler";
import { Cache, execAsync } from "./tools";
import { constPattern } from "./extension";
import { getLocationSymbol } from "./symbols";


export function registerCompletion(
  selector: DocumentSelector,
  context: ExtensionContext
): Disposable {
  const disposableRequires: Disposable = languages.registerCompletionItemProvider(
    selector,
    new CrystalRequiresCompletionProvider(),
    '"'
  )

  const disposableHierarchy: Disposable = languages.registerCompletionItemProvider(
    selector,
    new CrystalHierarchyCompletionProvider(),
    ':'
  )

  context.subscriptions.push(disposableRequires);
  context.subscriptions.push(disposableHierarchy);

  const disposable: Disposable = {
    dispose() {
      disposableRequires.dispose()
      disposableHierarchy.dispose()
    },
  }

  return disposable;
}

class CrystalRequiresCompletionProvider implements CompletionItemProvider {
  async provideCompletionItems(
    document: TextDocument, position: Position, token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList<CompletionItem>> {

    const line = document.lineAt(position.line);
    if (!line || /^\s*#\s*(?!{).+/.test(line.text)) return;

    if (!/^\s*require\s+"(.*)"\s*$/.test(line.text)) return;

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

    return items;
  }
}

export const hierarchyCache: Cache<HierarchyType> = new Cache<HierarchyType>();

export async function updateHierarchyCache(document: TextDocument, token: CancellationToken) {
  const hash = hierarchyCache.computeHash(document, undefined, true);

  spawnHierarchyTool(document, token)
    .then(response => {
      hierarchyCache.set(hash, response)
    })
}

class CrystalHierarchyCompletionProvider implements CompletionItemProvider {
  provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
    const config = getConfig()
    if (!config.get<string>("hierarchy-complete")) return;

    const line = document.lineAt(position.line);
    if (!line || /^\s*#\s*(?!{).+/.test(line.text)) return [];

    const wordRange = document.getWordRangeAtPosition(position, constPattern);
    if (!wordRange) return;

    const word = document.getText(wordRange);

    return getLocationSymbol(document, position, token)
      .then((locationSymbol) => {
        outputChannel.appendLine(`[Hierarchy] Namespace: ${locationSymbol}`)

        const hash = hierarchyCache.computeHash(document, undefined, true);

        if (hierarchyCache.has(hash)) {
          return this.generateCompletions(word, hierarchyCache.get(hash), wordRange, locationSymbol);
        }

        return spawnHierarchyTool(document, token)
          .then((response) => {
            hierarchyCache.set(hash, response)

            return this.generateCompletions(word, response, wordRange, locationSymbol);
          })
      });
  }

  generateCompletions(word: string, response: HierarchyType, wordRange: Range, locationSymbol: string) {
    const global = word.startsWith("::");
    const types = getHierarchyTypes(response);
    const locationSegments = this.splitAndJoin(locationSymbol);

    const completions: CompletionItem[] = [];

    for (const type of types) {
      if (global) {
        completions.push({
          label: "::" + type,
          range: wordRange
        });
        continue;
      }

      if (locationSymbol.length > 0) {
        for (const segment of locationSegments) {
          if (type.startsWith(segment)) {
            completions.push({
              label: type.replace(segment, ""),
              range: wordRange
            });
            continue;
          }
        }
      }

      completions.push({
        label: type,
        range: wordRange
      });
    }

    return completions;
  }

  splitAndJoin(input: String): string[] {
    const split = input.split("::")
    if (split[split.length - 1] === "") split.pop();

    const segments = []
    for (let i = split.length; i > 0; i--) {
      segments.push(split.slice(0, i).join("::") + "::")
    }

    if (segments.length === 0) return [];

    return segments;
  }
}

interface HierarchyType {
  name: string
  kind: string
  size_in_bytes?: number
  instance_vars?: HierarchyVar[]
  sub_types?: HierarchyType[]
}

interface HierarchyVar {
  name: string
  type: string
  size_in_bytes: number
}

export async function spawnHierarchyTool(document: TextDocument, token: CancellationToken): Promise<HierarchyType> {
  const config = getConfig();
  const mainFiles = await getDocumentMainFiles(document);
  const projectRoot = getProjectRoot(document.uri);

  const cmd = await getCompilerPath();
  const args = [
    'tool', 'hierarchy', ...mainFiles,
    '-f', 'json', '--no-color',
    ...getFlags(config)
  ]

  outputChannel.appendLine(`[Hierarchy] (${projectRoot.name}) $ ${cmd} ${args.join(' ')}`)

  return await execAsync(cmd, args, { cwd: projectRoot.uri.fsPath, token: token })
    .then((response) => {
      if (response.stdout.length === 0) {
        outputChannel.appendLine(`[Hierarchy] Error: ${response.stderr}`)
        return;
      }

      findProblems(response.stderr, document.uri);

      return JSON.parse(response.stdout);
    })
    .catch((err) => {
      outputChannel.appendLine(`[Hierarchy] Error: ${err?.message || JSON.stringify(err)}`)
    })
    .finally(() => outputChannel.appendLine(`[Hierarchy] Done.`));
}

function getHierarchyTypes(type: HierarchyType): string[] {
  const types: string[] = []

  types.push(type.name)

  type?.sub_types.forEach((t) =>
    types.push(...getHierarchyTypes(t))
  )

  return types;
}
