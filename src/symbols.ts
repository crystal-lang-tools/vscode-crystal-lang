import {
    CancellationToken,
    DocumentSelector,
    DocumentSymbol,
    DocumentSymbolProvider,
    ExtensionContext,
    languages,
    Location,
    Position,
    ProviderResult,
    SymbolKind,
    SymbolInformation,
    TextDocument
} from 'vscode';

const MODULE_OR_LIB_PATTERN = /^\s*(?:private\s+)?(?:module|lib)\s+(\w+)[\r\n;]?$/;
const MACRO_PATTERN = /^\s*(?:private\s+)?macro\s+(\w+)(?:[\w\(\)\*,_]+)?[\r\n;]?$/;
const CLASS_PATTERN = /^\s*(?:abstract\s+)?(?:private\s+)?class\s+(\w+)(?:\s+<\s+\w+)?[\r\n;]?$/;
const STRUCT_PATTERN = /^\s*(?:abstract\s+)?(?:private\s+)?(struct|record)\s+(\w+)(?:\s+<\s+\w+)?(?:.+do\s+(?:\|.+\|)?)?[\r\n;]?$/;
const CONSTANT_PATTERN = /^\s*(?:([A-Z0-9_]+)\s+=.+|(?:private\s+)?(?:alias|type)\s+(\w+))[\r\n;]?$/;
const ENUM_OR_UNION_PATTERN = /^\s*(?:private\s+)?(?:enum|union)\s+(\w+)[\r\n;]?$/;
const DEF_PATTERN = /^\s*(?:abstract\s+)?(?:(?:private|protected)\s+)?(?:def|fun)\s+(\w+)(?:[\(\)\*:,]+)?.*$/;
const PROPERTY_PATTERN = /^\s*(?:(?:private|protected)\s+)?(?:class_)?(?:property|getter|setter)(?:!|\?)?\s+(\w+)(?:(?:\s+:\s+\w+)?(?:\s*=.+)?)?(?:,\s*)?[\r\n;]?/;
const IVAR_PATTERN = /^\s*@(\w+)\s+[:=].+[\r\n;]?$/;
const VARIABLE_PATTERN = /^\s*(\w+)\s+[:=].+[\r\n;]?$/;

class CrystalDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        const lines = document.getText().split(process.platform === 'win32' ? '\r\n' : '\n');
        const symbols: {name: string, kind: SymbolKind}[] = [];
        let inline = 0;
        let matches: RegExpExecArray;
        let containers: string[] = [];

        function setContainer(value: string): void {
            if (containers.includes(value)) containers.pop();
            containers.push(value);
        }

        for (let line of lines) {
            if (/^\s*#.*/.test(line)) continue;

            matches = DEF_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Function });
                inline++;
                continue;
            }

            matches = MACRO_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Function });
                inline++;
                continue;
            }

            matches = CLASS_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Class });
                setContainer(matches[1]);
                inline++;
                continue;
            }

            matches = PROPERTY_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Class });
                inline++;
                continue;
            }

            matches = STRUCT_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[2], kind: SymbolKind.Struct });
                if (matches[1] === 'struct' || !/.+do\s+(?:\|.+\|)?$/.test(line)) {
                    setContainer(matches[1]);
                    inline++;
                }
                continue;
            }

            matches = MODULE_OR_LIB_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Module });
                setContainer(matches[1]);
                inline++;
                continue;
            }

            matches = ENUM_OR_UNION_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Enum });
                inline++;
                continue;
            }

            matches = CONSTANT_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Constant });
                inline++;
                continue;
            }

            matches = IVAR_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Property });
                continue;
            }

            matches = VARIABLE_PATTERN.exec(line);
            if (matches.length) {
                symbols.push({ name: matches[1], kind: SymbolKind.Variable });
                continue;
            }

            if (/\s*end(?:\..*)?$/.test(line)) {
                inline--;
                if (inline <= 0) containers = [];
                continue;
            }

            if (/\s*(?:.+=\s*)?(?:if|unless|while|until|select|case|begin)/.test(line)) {
                inline++;
                continue;
            }

            if (/^.+do\s+(?:\|.+\|)?$/.test(line)) {
                inline++;
                continue;
            }
        }

        return symbols.map(
            (sym, i) => new SymbolInformation(
                sym.name,
                sym.kind,
                containers[i - 1],
                new Location(document.uri, new Position(i, 0))
            )
        );
    }
}

export function registerSymbols(selector: DocumentSelector, context: ExtensionContext): void {
    context.subscriptions.push(
        languages.registerDocumentSymbolProvider(selector, new CrystalDocumentSymbolProvider())
    );
}
