import * as vscode from 'vscode';
import * as TDATA from './crystalCompletionData';
import { getSymbols, spawnTools } from './crystalUtils';

export interface CompletionResponse {
    status: string;
    contexts: Record<string, string>[];
}

export class CrystalCompletionItemProvider implements vscode.CompletionItemProvider {
    private completions: vscode.CompletionList;

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        this.completions = new vscode.CompletionList();
        const config = vscode.workspace.getConfiguration('crystal-lang');
        if (!config.get<boolean>('completion')) return this.completions;

        const line = document.getText(new vscode.Range(
            new vscode.Position(position.line, 0),
            position
        ));
        if (!line || /^(?:".+|#(?!{).*)$/g.test(line)) return this.completions;

        const column = position.character > 2 ? position.character - 2 : 0; // Remove dot or colons and search for a word
        const dotPos = new vscode.Position(position.line, column + 1);
        const columnPos = new vscode.Position(position.line, column);
        const wordRange = document.getWordRangeAtPosition(dotPos) || document.getWordRangeAtPosition(columnPos);
        const symbols = await getSymbols(document.uri);
        let canComplete = false;

        if (wordRange) {
            const word = document.getText(new vscode.Range(
                wordRange.start.line,
                wordRange.start.character,
                wordRange.end.line,
                wordRange.end.character + 1
            ));

            if (word.endsWith('.')) {
                this.pushCompletionMethods(TDATA.REFLECTION_METHODS);
                canComplete = true;
                let container = word.slice(0, -1);
                let symbolNames = symbols.map(s => s.name);
                let symbolIndex = symbolNames.indexOf(container);
                let foundStatic = false;
    
                if (symbolIndex >= 0) {
                    for (let symbol of symbols) {
                        if (symbol.name.startsWith('self')) {
                            foundStatic = true;
                            this.pushCompletionMethod([symbol.name.slice(5), symbol.containerName, `Static method of ${word}`], symbol.kind);
                        }
                    }

                    let symbol = symbols[symbolIndex];
                    if (symbol.kind === vscode.SymbolKind.Class || symbol.kind === vscode.SymbolKind.Struct) {
                        foundStatic = true;
                        this.pushCompletionMethod(
                            [
                                'new',
                                'new(*args, **options)',
                                `Initializes a new instance of ${word}`
                            ],
                            vscode.SymbolKind.Method
                        );
                    }
                }

                if (!foundStatic) {
                    switch (container) {
                        case 'Array':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.ARRAY_METHODS);
							break;
						case 'Bool':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.BOOL_METHODS);
							break;
						case 'Channel':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.CHANNEL_METHODS);
							break;
						case 'Char':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.CHAR_METHODS);
							break;
						case 'Dir':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.DIR_METHODS);
							break;
						case 'File':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.FILE_METHODS);
							break;
						case 'Float':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.FLOAT_METHODS);
							break;
						case 'Hash':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.HASH_METHODS);
							break;
						case 'Int':
							foundStatic = true;
							this.pushCompletionMethods(TDATA.INT_METHODS);
							break;
                    }
                }

                if (!foundStatic) {
                    try {
                        const output = await spawnTools(document, position, 'context', 'completion');
                        const response = <CompletionResponse> JSON.parse(output as string);
                        if (response.status !== 'ok') return this.completions;

                        for (let context of response.contexts) {
                            let type = context[container];
                            if (!type) continue;

                            if (type.endsWith('Nil')) {
                                this.pushCompletionMethods(TDATA.NIL_METHODS);
                            } else if (type.startsWith('Array')) {
                                this.pushCompletionMethods(TDATA.ARRAY_METHODS);
                            } else if (type.startsWith('Tuple')) {
                                this.pushCompletionMethods(TDATA.TUPLE_METHODS);
                            } else if (type.startsWith('Range')) {
                                this.pushCompletionMethods(TDATA.RANGE_METHODS);
                            } else if (type.startsWith('Hash')) {
                                this.pushCompletionMethods(TDATA.HASH_METHODS);
                            } else if (type.startsWith('NamedTuple')) {
                                this.pushCompletionMethods(TDATA.NAMEDTUPLE_METHODS);
                            } else if (type.startsWith('Channel')) {
                                this.pushCompletionMethods(TDATA.CHANNEL_METHODS);
                            } else if (type.startsWith('Proc')) {
                                this.pushCompletionMethods(TDATA.PROC_METHODS);
                            } else {
                                switch (type) {
                                    case 'Nil':
                                        this.pushCompletionMethods(TDATA.NIL_METHODS);
                                        break;
                                    case 'String':
                                        this.pushCompletionMethods(TDATA.STRING_METHODS);
                                        break;
                                    case 'Int':
                                    case 'Int8':
                                    case 'Int16':
                                    case 'Int32':
                                    case 'Int64':
                                    case 'UInt':
                                    case 'UInt8':
                                    case 'UInt16':
                                    case 'UInt32':
                                    case 'UInt64':
                                        this.pushCompletionMethods(TDATA.INT_METHODS);
                                        break;
                                    case 'Float':
                                    case 'Float32':
                                    case 'Float64':
                                        this.pushCompletionMethods(TDATA.FLOAT_METHODS);
                                        break;
                                    case 'Bool':
                                        this.pushCompletionMethods(TDATA.BOOL_METHODS);
                                        break;
                                    case 'Char':
                                        this.pushCompletionMethods(TDATA.CHAR_METHODS);
                                        break;
                                    case 'Symbol':
                                        this.pushCompletionMethods(TDATA.SYMBOLS_METHODS);
                                        break;
                                    case 'Regex':
                                        this.pushCompletionMethods(TDATA.REGEX_METHODS);
                                        break;
                                }
                            }

                            let symbolType = type.split('::').pop();
                            for (let symbol of symbols) {
                                if (
                                    symbol.containerName === symbolType &&
                                    !symbol.name.startsWith('self.') &&
                                    symbol.name !== 'initialize' &&
                                    symbol.kind === vscode.SymbolKind.Function
                                ) {
                                    this.pushCompletionMethod([symbol.name, symbol.containerName, `Instance method of ${type}`], symbol.kind);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('ERROR: failed to parse JSON from Crystal context');
                        throw err;
                    }
                }
            } else {
                const word = document.getText(new vscode.Range(
                    wordRange.start.line,
                    wordRange.start.character,
                    wordRange.end.line,
                    wordRange.end.character + 2
                ));

                if (word.endsWith('::')) {
                    canComplete = true;
                    let container = word.slice(0, -2);

                    for (let symbol of symbols) {
                        if (
                            symbol.containerName === container &&
                            symbol.kind !== vscode.SymbolKind.Function
                        ) {
                            this.pushCompletionMethod([symbol.name, symbol.containerName, `Belongs to ${container}`], symbol.kind);
                        }
                    }
                } else if (word.endsWith(').')) {
                    // TODO
                }
            }
        }

        if (!canComplete) {
            symbols.forEach(s => this.pushCompletionMethod([s.name, s.containerName, ''], s.kind));

            this.pushCompletions(TDATA.TOP_LEVEL_METHODS, vscode.SymbolKind.Method);
            this.pushCompletions(TDATA.STRUCTS, vscode.SymbolKind.Struct);
            this.pushCompletions(TDATA.ENUMS, vscode.SymbolKind.Enum);
            this.pushCompletions(TDATA.CLASSES, vscode.SymbolKind.Class);
            this.pushCompletions(TDATA.MODULES, vscode.SymbolKind.Module);
            this.pushCompletions(TDATA.ALIAS, vscode.SymbolKind.Constant);
        }

        return this.completions;
    }

    private pushCompletionMethods(completions: TDATA.Completion[]): void {
        this.pushCompletions(completions, vscode.SymbolKind.Method);
    }

    private pushCompletions(completions: TDATA.Completion[], kind: vscode.SymbolKind): void {
        completions.forEach(c => this.pushCompletionMethod(c, kind));
    }

    private pushCompletionMethod(completion: TDATA.Completion, kind: vscode.SymbolKind): void {
        let comp = new vscode.CompletionItem(completion[0], this.getItemKind(kind));
        comp.detail = completion[1];
        comp.documentation = completion[2];
        comp.sortText = ('0000' + this.completions.items.length).slice(-4);
        this.completions.items.push(comp);
    }

    private getItemKind(kind: vscode.SymbolKind): vscode.CompletionItemKind {
		switch (kind) {
			case 1:
				return vscode.CompletionItemKind.Module;
			case 4:
				return vscode.CompletionItemKind.Class;
			case 5:
				return vscode.CompletionItemKind.Method;
			case 6:
				return vscode.CompletionItemKind.Property;
			case 9:
				return vscode.CompletionItemKind.Enum;
			case 11:
				return vscode.CompletionItemKind.Function;
			case 12:
				return vscode.CompletionItemKind.Variable;
			case 13:
				return vscode.CompletionItemKind.Constant;
			case 22:
				return vscode.CompletionItemKind.Struct;
			default:
				return 0;
		}
	}
}