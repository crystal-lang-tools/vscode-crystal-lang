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
	TextDocument,
} from 'vscode';

const MODULE_OR_LIB_PATTERN =
	/^\s*(?:private\s+)?(?:module|lib)\s+(\w+)[\r\n;]?$/;
const MACRO_PATTERN =
	/^\s*(?:private\s+)?macro\s+(\w+)(?:[\w\(\)\*,_]+)?[\r\n;]?$/;
const CLASS_PATTERN =
	/^\s*(?:abstract\s+)?(?:private\s+)?class\s+(\w+)(?:\s+<\s+\w+)?[\r\n;]?$/;
const STRUCT_PATTERN =
	/^\s*(?:abstract\s+)?(?:private\s+)?(?:struct|record)\s+(\w+)(?:\s+<\s+\w+)?(?:.+do(?:\s+\|.+\|)?)?[\r\n;]?$/;
const CONSTANT_PATTERN =
	/^\s*(?:([A-Z0-9_]+)\s+=.+|(?:private\s+)?(?:alias|type)\s+(\w+))[\r\n;]?$/;
const ENUM_OR_UNION_PATTERN =
	/^\s*(?:private\s+)?(?:enum|union)\s+(\w+)[\r\n;]?$/;
const DEF_PATTERN =
	/^\s*(?:abstract\s+)?(?:(?:private|protected)\s+)?(?:def|fun)\s+(\w+)(?:[\(\)\*:,]+)?.*$/;
const PROPERTY_PATTERN =
	/^\s*(?:(?:private|protected)\s+)?(?:class_)?(?:property|getter|setter)(?:!|\?)?\s+(\w+)(?:(?:\s+:\s+\w+)?(?:\s*=.+)?)?(?:,\s*)?[\r\n;]?/;
const IVAR_PATTERN = /^\s*@(\w+)\s+[:=].+[\r\n;]?$/;
const CLASS_IVAR_PATTERN = /^\s*@@(\w+)\s+[:=].+[\r\n;]?$/;
const VARIABLE_PATTERN = /^\s*(\w+)\s+[:=].+[\r\n;]?$/;

class CrystalDocumentSymbolProvider implements DocumentSymbolProvider {
	private symbols: SymbolInformation[];
	private container: string[];

	provideDocumentSymbols(
		document: TextDocument,
		token: CancellationToken
	): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
		this.symbols = [];
		this.container = [];

		const lines = document
			.getText()
			.split(/\r?\n/);
		let matches: RegExpExecArray;

		for (let [index, line] of lines.entries()) {
			if (/^\s*#.*/.test(line)) continue;

			matches = DEF_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(
					matches[1],
					this.container.length ? SymbolKind.Method : SymbolKind.Function,
					document,
					index
				);
				continue;
			}

			matches = MACRO_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Function, document, index);
				continue;
			}

			matches = CLASS_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Class, document, index);
				this.container.push(matches[1]);
				continue;
			}

			matches = PROPERTY_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Method, document, index);
				continue;
			}

			matches = STRUCT_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Struct, document, index);
				this.container.push(matches[1]);
				continue;
			}

			matches = MODULE_OR_LIB_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Module, document, index);
				this.container.push(matches[1]);
				continue;
			}

			matches = ENUM_OR_UNION_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Enum, document, index);
				this.container.push(matches[1]);
				continue;
			}

			matches = CONSTANT_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Constant, document, index);
				continue;
			}

			matches = IVAR_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Property, document, index);
				continue;
			}

			matches = CLASS_IVAR_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Property, document, index);
				continue;
			}

			matches = VARIABLE_PATTERN.exec(line);
			if (matches && matches.length) {
				this.create(matches[1], SymbolKind.Variable, document, index);
				continue;
			}

			if (/\s*end(?:\..*)?$/.test(line)) {
				this.container.pop();
				continue;
			}
		}

		console.debug(this.symbols);
		return this.symbols;
	}

	private create(
		name: string,
		kind: SymbolKind,
		{ uri }: TextDocument,
		index: number
	): void {
		const loc = new Location(uri, new Position(index, 0));
		this.symbols.push(
			new SymbolInformation(name, kind, this.container[index - 1], loc)
		);
	}
}

export function registerSymbols(
	selector: DocumentSelector,
	context: ExtensionContext
): void {
	context.subscriptions.push(
		languages.registerDocumentSymbolProvider(
			selector,
			new CrystalDocumentSymbolProvider()
		)
	);
}
