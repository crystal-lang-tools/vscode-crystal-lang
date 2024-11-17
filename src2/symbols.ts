import {
  CancellationToken, DocumentSelector, DocumentSymbolProvider,
  ExtensionContext, languages, Location,
  Position, ProviderResult, SymbolKind,
  SymbolInformation, TextDocument, Disposable,
  Uri, Range,
  WorkspaceSymbolProvider,
  workspace
} from 'vscode';
import { glob } from 'glob';
import path = require('path');
import { lstatSync, readFileSync } from 'fs';

import { outputChannel } from './vscode';
import { Cache, MtimeCache } from './tools';

const MODULE_OR_LIB_PATTERN =
  /^\s*(?:private\s+)?(?:module|lib)\s+([:\w]+(?:\([\w, ]+\))?)[\r\n;]?$/;
const MACRO_PATTERN =
  /^\s*(?:private\s+)?macro\s+(\w+)(?:.*)?[\r\n;]?$/;
const CLASS_PATTERN =
  /^\s*(?:abstract\s+)?(?:private\s+)?class\s+([:\w]+(?:\([\w, ]+\))?)(?:\s+<\s+[:\w]+(?:\([\w, ]+\))?)?[\r\n;]?$/;
const STRUCT_PATTERN =
  /^\s*(?:abstract\s+)?(?:private\s+)?(?:struct|record)\s+([:\w]+(?:\([\w, ]+\))?)(?:\s+<\s+[:\w]+)?(?:.+do(?:\s+\|.+\|)?)?[\r\n;]?$/;
const CONSTANT_PATTERN =
  /^\s*(?:private\s+)?(?:type\s+|alias\s+)?([A-Z][A-Za-z0-9]*)\s+=\s+(.+)$/;
const ENUM_OR_UNION_PATTERN =
  /^\s*(?:private\s+)?(?:enum|union)\s+([:\w]+)(?:\s+:\s+\w+)?[\r\n;]?$/;
const DEF_PATTERN =
  /^\s*(abstract\s+)?(?:(?:private|protected)\s+)?(?:def|fun)\s+([^\( ]*)(?:[\(\)\*:,]+)?.*$/;
const PROPERTY_PATTERN =
  /^\s*(?:(?:private|protected)\s+)?(?:class_)?(?:property|getter|setter)(?:!|\?)?\s+(\w+)(?:(?:\s+:\s+\w+)?(?:\s*=.+)?)?(?:,\s*)?[\r\n;]?/;
const IVAR_PATTERN = /^\s*(@\w+)\s+[:=].+[\r\n;]?$/;
const CLASS_IVAR_PATTERN = /^\s*(@@\w+)\s+[:=].+[\r\n;]?$/;
const VARIABLE_PATTERN = /^\s*(\w+)\s+[:=].+[\r\n;]?$/;
const CONTROL_PATTERN = /^\s*(?:.*=\s+)?(select|case|if|unless|until|while|begin)(?:\s+.*)?$/;
const BLOCK_START_PATTERN = /^\s*(.*)\s+(do|begin)\s*(?:\|[^|]*\|)?\s*$/;


interface SymbolLoc {
  name: string,
  kind: SymbolKind,
  start: number,
  endLine: number,
  endCol: number
}

export interface TextDocumentContents {
  uri: Uri,
  fileName: string,
  getText: () => string,
}

class CrystalSymbolProvider implements WorkspaceSymbolProvider {
  private cache: MtimeCache<SymbolInformation[]> = new MtimeCache();

  provideWorkspaceSymbols(query: string, token: CancellationToken): ProviderResult<SymbolInformation[]> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    let allSymbols: SymbolInformation[] = [];

    try {
      for (const folder of workspaceFolders) {
        const crystalFiles = this.getCrystalFiles(folder.uri.fsPath);

        for (const fileName of crystalFiles) {
          if (token.isCancellationRequested) return [];

          const filePath = path.join(folder.uri.fsPath, fileName);
          if (lstatSync(filePath).isDirectory()) continue;

          const openDocument = workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
          const mtime = this.cache.computeMtimeHash(filePath);

          if (openDocument && openDocument.isDirty) {
            const symbols = this.provideDocumentSymbols(openDocument, token) as SymbolInformation[];
            if (symbols) {
              allSymbols.push(...symbols);

              this.cache.set(filePath, mtime, symbols);
            }
          } else {
            if (this.cache.has(filePath, mtime)) {
              allSymbols.push(...this.cache.get(filePath)!);
            } else {
              const document = this.createTextDocument(filePath);
              const symbols = this.provideDocumentSymbols(document, token) as SymbolInformation[];

              if (symbols) {
                allSymbols.push(...symbols);

                this.cache.set(filePath, mtime, symbols);
              }
            }
          }
        }
      }
    } catch (e) {
      outputChannel.appendLine(JSON.stringify(e));
    }

    return allSymbols;
  }

  private getCrystalFiles(directory: string): string[] {
    return glob.sync(`**/*.cr`, { cwd: directory });
  }

  private createTextDocument(filePath: string): TextDocumentContents {
    const openDocument = workspace.textDocuments.find(doc => doc.uri.fsPath == filePath);
    if (openDocument) {
      return openDocument;
    }

    const content = readFileSync(filePath, 'utf-8');
    return {
      uri: Uri.parse(filePath),
      fileName: path.basename(filePath),
      getText: () => content
    };
  }

  resolveWorkspaceSymbol?(symbol: SymbolInformation, token: CancellationToken): ProviderResult<SymbolInformation> {
    return symbol;
  }

  provideDocumentSymbols(
    document: TextDocument | TextDocumentContents,
    token: CancellationToken
  ): ProviderResult<SymbolInformation[]> {
    if (document.fileName.endsWith(".ecr")) return;

    const container: SymbolLoc[] = [];
    const symbols: SymbolInformation[] = [];

    const lines = document.getText().split(/\r?\n/);
    let matches: RegExpExecArray;

    try {
      for (let [index, line] of lines.entries()) {
        if (token.isCancellationRequested) {
          return [];
        }

        matches = /^\s*#(?!{).*$/.exec(line);
        if (matches) {
          continue;
        }

        matches = DEF_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[2],
            kind: SymbolKind.Function,
            start: index,
            endLine: null,
            endCol: line.length
          };

          if (!matches[1]) {
            container.push(symbol);
          } else {
            symbols.push(this.dumpContainer(symbol, document.uri));
          }

          continue;
        }

        matches = MACRO_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Method,
            start: index,
            endLine: null,
            endCol: line.length
          };

          this.checkIfInFunction(container, symbol);

          container.push(symbol);
          continue;
        }

        matches = CLASS_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Class,
            start: index,
            endLine: null,
            endCol: line.length
          };

          container.push(symbol);
          continue;
        }

        matches = PROPERTY_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Property,
            start: index,
            endLine: null,
            endCol: line.length
          };

          symbols.push(this.dumpContainer(symbol, document.uri));

          matches = BLOCK_START_PATTERN.exec(line);
          if (matches && matches.length) {
            const symbol = {
              name: null,
              kind: null,
              start: index,
              endLine: null,
              endCol: line.length
            };

            container.push(symbol);
          }

          continue;
        }

        matches = STRUCT_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Struct,
            start: index,
            endLine: null,
            endCol: line.length
          };

          container.push(symbol);
          continue;
        }

        matches = MODULE_OR_LIB_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Module,
            start: index,
            endLine: null,
            endCol: line.length
          };

          container.push(symbol);
          continue;
        }

        matches = ENUM_OR_UNION_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Enum,
            start: index,
            endLine: null,
            endCol: line.length
          };

          container.push(symbol);
          continue;
        }

        matches = CONTROL_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: null,
            kind: null,
            start: index,
            endLine: null,
            endCol: line.length
          };

          container.push(symbol);
          continue;
        }

        matches = BLOCK_START_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Namespace,
            start: index,
            endLine: null,
            endCol: line.length
          };

          this.checkIfInFunction(container, symbol);

          container.push(symbol);
          continue;
        }

        matches = CONSTANT_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Constant,
            start: index,
            endLine: null,
            endCol: line.length
          };

          symbols.push(this.dumpContainer(symbol, document.uri));
          continue;
        }

        matches = IVAR_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Property,
            start: index,
            endLine: null,
            endCol: line.length
          };

          symbols.push(this.dumpContainer(symbol, document.uri));
          continue;
        }

        matches = CLASS_IVAR_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Property,
            start: index,
            endLine: null,
            endCol: line.length
          };

          symbols.push(this.dumpContainer(symbol, document.uri));
          continue;
        }

        matches = VARIABLE_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Variable,
            start: index,
            endLine: null,
            endCol: line.length
          };

          this.checkIfInFunction(container, symbol);
          this.checkIfInNamespace(container, symbol);

          if (symbol?.name) {
            symbols.push(this.dumpContainer(symbol, document.uri));
          }

          continue;
        }

        if (/^\s*end(?:\..*)?$/.test(line)) {
          const symbol = container.pop();

          if (symbol && symbol?.name) {
            symbol.endLine = index;
            symbols.push(this.dumpContainer(symbol, document.uri));
          }
          continue;
        }
      }

      for (const symbol of container) {
        if (symbol && symbol?.name) {
          symbol.endLine = lines.length;
          symbols.push(this.dumpContainer(symbol, document.uri));
        }
      }

      return symbols;
    } catch (err) {
      outputChannel.appendLine(`[Symbols] Error: ${JSON.stringify(err)}`);
    }
  }

  private checkIfInFunction(container: SymbolLoc[], symbol: { name: string; kind: SymbolKind; start: number; endLine: any; endCol: number; }) {
    for (let c of container) {
      if (c.kind == SymbolKind.Function || c.kind == SymbolKind.Method) {
        symbol.name = null;
        return;
      }
    }
  }

  private checkIfInNamespace(container: SymbolLoc[], symbol: { name: string; kind: SymbolKind; start: number; endLine: any; endCol: number; }) {
    for (let c of container) {
      if (c.kind == SymbolKind.Namespace) {
        symbol.name = null;
        return;
      }
    }
  }

  dumpContainer(symbol: SymbolLoc, uri: Uri): SymbolInformation {
    const loc = new Location(uri,
      new Range(
        new Position(symbol.start, 0),
        new Position(
          (symbol.endLine === null) ? symbol.start : symbol.endLine,
          symbol.endCol
        )
      )
    );

    if (symbol?.name) {
      const symbolInfo = new SymbolInformation(symbol.name, symbol.kind, '', loc);
      return symbolInfo;
    }
  }
}



export function registerSymbols(
  selector: DocumentSelector,
  context: ExtensionContext
): Disposable {
  const disposableDocument = languages.registerDocumentSymbolProvider(
    selector,
    new CrystalSymbolProvider()
  )

  const disposableWorkspace = languages.registerWorkspaceSymbolProvider(
    new CrystalSymbolProvider()
  )

  context.subscriptions.push(disposableDocument);
  context.subscriptions.push(disposableWorkspace);

  const disposable: Disposable = {
    dispose() {
      disposableDocument.dispose()
      disposableWorkspace.dispose()
    },
  }

  return disposable;
}

export async function getLocationSymbol(document: TextDocument, position: Position, token: CancellationToken): Promise<string> {
  const provider = new CrystalSymbolProvider();
  const symbols = await provider.provideDocumentSymbols(document, token);

  let name = ""

  for (let symbol of symbols) {
    const range = new Range(
      new Position(symbol.location.range.start.line + 1, symbol.location.range.start.character),
      new Position(symbol.location.range.end.line, symbol.location.range.end.character)
    )

    if (range.contains(position) && symbol.name.match(/^[A-Z]/)) {
      name = symbol.name + "::" + name
    }
  }

  return name;
}
