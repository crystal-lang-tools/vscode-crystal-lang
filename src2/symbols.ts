import {
  CancellationToken, DocumentSelector, DocumentSymbolProvider,
  ExtensionContext, languages, Location,
  Position, ProviderResult, SymbolKind,
  SymbolInformation, TextDocument, Disposable,
  Uri, Range
} from 'vscode';

import { outputChannel } from './vscode';

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
const BLOCK_START_PATTERN = /^\s*.*\s+(do|begin)\s*(?:\|[^|]*\|)?\s*$/;


interface SymbolLoc {
  name: string,
  kind: SymbolKind,
  start: number,
  endLine: number,
  endCol: number
}

class CrystalDocumentSymbolProvider implements DocumentSymbolProvider {
  provideDocumentSymbols(
    document: TextDocument,
    token: CancellationToken
  ): ProviderResult<SymbolInformation[]> {
    if (document.fileName.endsWith(".ecr")) return;
    // outputChannel.appendLine(`[Symbols] Searching for symbols in ${document.fileName}`);

    const container: SymbolLoc[] = [];
    const symbols: SymbolInformation[] = []
    let inMacro = false

    const lines = document
      .getText()
      .split(/\r?\n/);
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
          }

          if (!matches[1]) {
            container.push(symbol)
          } else {
            symbols.push(this.dumpContainer(symbol, document.uri))
          }

          continue;
        }

        matches = MACRO_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Function,
            start: index,
            endLine: null,
            endCol: line.length
          };

          container.push(symbol)
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

          container.push(symbol)
          continue;
        }

        matches = PROPERTY_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: matches[1],
            kind: SymbolKind.Method,
            start: index,
            endLine: null,
            endCol: line.length
          };

          symbols.push(this.dumpContainer(symbol, document.uri))

          matches = BLOCK_START_PATTERN.exec(line);
          if (matches && matches.length) {
            const symbol = {
              name: null,
              kind: null,
              start: index,
              endLine: null,
              endCol: line.length
            };

            container.push(symbol)
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

          container.push(symbol)
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

          container.push(symbol)
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

          container.push(symbol)
          continue;
        }

        // Need to just match the end, there's no symbol for a case statement
        matches = CONTROL_PATTERN.exec(line) || BLOCK_START_PATTERN.exec(line);
        if (matches && matches.length) {
          const symbol = {
            name: null,
            kind: null,
            start: index,
            endLine: null,
            endCol: line.length
          };

          container.push(symbol)
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

          symbols.push(this.dumpContainer(symbol, document.uri))
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

          symbols.push(this.dumpContainer(symbol, document.uri))
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

          symbols.push(this.dumpContainer(symbol, document.uri))
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

          symbols.push(this.dumpContainer(symbol, document.uri))
          continue;
        }

        if (/^\s*end(?:\..*)?$/.test(line)) {
          const symbol = container.pop()

          if (symbol && symbol?.name) {
            symbol.endLine = index;
            symbols.push(this.dumpContainer(symbol, document.uri))
          }
          continue;
        }
      }

      // outputChannel.appendLine(`[Symbols] Found symbols: ${symbols.map(s => s?.name).join(", ")}`);
      // outputChannel.appendLine(`[Symbols] Success.`)
      return symbols;
    } catch (err) {
      outputChannel.appendLine(`[Symbols] Error: ${JSON.stringify(err)}`)
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
    )

    if (symbol?.name) {
      const symbolInfo = new SymbolInformation(symbol.name, symbol.kind, '', loc)
      return symbolInfo;
    }
  }
}


export function registerSymbols(
  selector: DocumentSelector,
  context: ExtensionContext
): Disposable {
  const disposable = languages.registerDocumentSymbolProvider(
    selector,
    new CrystalDocumentSymbolProvider()
  )

  context.subscriptions.push(disposable);

  return disposable;
}

export async function getLocationSymbol(document: TextDocument, position: Position, token: CancellationToken): Promise<string> {
  const provider = new CrystalDocumentSymbolProvider();
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
