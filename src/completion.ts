import {
	CancellationToken,
	CompletionContext,
	CompletionItem,
	CompletionItemKind,
	CompletionItemProvider,
	CompletionList,
	DocumentSelector,
	ExtensionContext,
	languages,
	Position,
	Range,
	SymbolKind,
	TextDocument,
} from 'vscode';
import globals from './definitions/globals';
import methods from './definitions/methods';

class CrystalCompletionItemProvider implements CompletionItemProvider {
	private completions: CompletionItem[];

	async provideCompletionItems(
		document: TextDocument,
		position: Position,
		token: CancellationToken,
		context: CompletionContext
	): Promise<CompletionItem[] | CompletionList<CompletionItem>> {
		this.completions = [];
		// TODO: These should be added where types or classes are appropriate
		// this.push(globals.CLASSES, SymbolKind.Class);
		// this.push(globals.MODULES, SymbolKind.Module);
		// this.push(globals.STRUCTS, SymbolKind.Struct);

		const line = document.lineAt(position.line);
		if (!line || /^#(?!{).+/.test(line.text)) return [];

		const column = new Position(
			position.line,
			position.character > 2 ? position.character - 2 : 0
		);
		const dot = new Position(position.line, column.character + 1);
		const range =
			document.getWordRangeAtPosition(dot) ||
			document.getWordRangeAtPosition(column);
		// TODO: check symbols

		if (range) {
			let text = document.getText(
				new Range(
					range.start.line,
					range.start.character,
					range.end.line,
					range.end.character + 1
				)
			);

			if (text.endsWith('.')) {
				this.push(methods.PSEUDO, SymbolKind.Method);
				let isStatic = false;
			} else {
				let text = document.getText(
					new Range(
						range.start.line,
						range.start.character,
						range.end.line,
						range.end.character + 2
					)
				);
				// TODO: handle ::
			}
		} else {
			this.push(methods.TOP_LEVEL, SymbolKind.Method);
		}

		return this.completions;
	}

	private push(data: string[][], kind: SymbolKind): void {
		data.forEach(d => this.create(d, kind));
	}

	private create(data: string[], kind: SymbolKind): void {
		const comp = new CompletionItem(data[0], this.getKind(kind));
		comp.detail = data[1];
		comp.documentation = data[2];
		comp.sortText = ('0000' + this.completions.length).slice(-4);
		this.completions.push(comp);
	}

	private getKind(kind: SymbolKind): CompletionItemKind {
		switch (kind) {
			case SymbolKind.Module:
				return CompletionItemKind.Module;
			case SymbolKind.Class:
				return CompletionItemKind.Class;
			case SymbolKind.Struct:
				return CompletionItemKind.Struct;
			case SymbolKind.Constant:
				return CompletionItemKind.Constant;
			case SymbolKind.Enum:
				return CompletionItemKind.Enum;
			case SymbolKind.Function:
				return CompletionItemKind.Function;
			case SymbolKind.Property:
				return CompletionItemKind.Property;
			case SymbolKind.Method:
				return CompletionItemKind.Method;
			case SymbolKind.Variable:
				return CompletionItemKind.Variable;
		}
	}
}

export function registerCompletion(
	selector: DocumentSelector,
	context: ExtensionContext
): void {
	context.subscriptions.push(
		languages.registerCompletionItemProvider(
			selector,
			new CrystalCompletionItemProvider(),
			'.',
			'::'
		)
	);
}
