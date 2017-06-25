import * as vscode from 'vscode'
import * as TDATA from './crystalCompletionData'
import { CrystalContext } from './crystalContext'

export class crystalCompletionItemProvider extends CrystalContext implements vscode.CompletionItemProvider {

	private completions: vscode.CompletionList

	private getItemKindFromSymbolKind(kind) {
		let itemKind = 0
		switch (kind) {
			case 4:
				itemKind = vscode.CompletionItemKind.Class
				break
			case 11:
				itemKind = vscode.CompletionItemKind.Function
				break
			case 6:
				itemKind = vscode.CompletionItemKind.Property
				break
			case 22:
				itemKind = vscode.CompletionItemKind.Struct
				break
			case 1:
				itemKind = vscode.CompletionItemKind.Module
				break
			case 9:
				itemKind = vscode.CompletionItemKind.Enum
				break
			case 13:
				itemKind = vscode.CompletionItemKind.Constant
				break
			case 12:
				itemKind = vscode.CompletionItemKind.Variable
				break
			case 5:
				itemKind = vscode.CompletionItemKind.Method
				break
		}
		return itemKind
	}

	private pushCompletionMethods(completions) {
		for (let method of completions) {
			this.createCompletionItem(method[0], method[1], method[2], vscode.SymbolKind.Method)
		}
	}

	private createCompletionItem(name, detail, documentation, kind) {
		let completion = new vscode.CompletionItem(`${name}`, this.getItemKindFromSymbolKind(kind))
		completion.documentation = documentation
		completion.detail = detail
		this.completions.items.push(completion)
	}

	private getSymbols(uri): Thenable<vscode.SymbolInformation[]> {
		return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri);
	}

	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		// ---------------------------------------
		// TODO: improve Type completion algorithm
		// ---------------------------------------
		this.completions = new vscode.CompletionList
		// Remove dot and search for a word
		let column = (position.character > 0) ? (position.character - 2) : 0
		let posDot = new vscode.Position(position.line, column + 1)
		let posColons = new vscode.Position(position.line, column)
		let wr = document.getWordRangeAtPosition(posDot) || document.getWordRangeAtPosition(posColons)
		let symbols = await this.getSymbols(document.uri);
		if (wr) {
			// Check if a call token (.|::) follow the word for a method call
			let range = new vscode.Range(wr.start.line, wr.start.character, wr.end.line, wr.end.character + 1)
			let word = document.getText(range)
			if (word.endsWith('.')) {
				try {
					// Add static methods to Types completion
					for (let symbol of symbols) {
						if (symbol.containerName == word.slice(0, -1) && symbol.name.startsWith('self')) {
							this.createCompletionItem(symbol.name.slice(5), symbol.containerName, `Belongs to ${word}`, symbol.kind)
						}
					}
					// Add Type reflection
					this.pushCompletionMethods(TDATA.REFLECTION)
					let crystalOutput = await this.crystalContext(document, position, 'completion')
					let crystalMessageObject = JSON.parse(crystalOutput.toString())
					if (crystalMessageObject.status == "ok") {
						for (let context of crystalMessageObject.contexts) {
							let type = context[word.slice(0, -1)]
							if (type) {
								if (type == 'Nil') {
									this.pushCompletionMethods(TDATA.NIL)
								} else if (type == 'Bool') {
									this.pushCompletionMethods(TDATA.BOOL)
								} else if (type.startsWith('Int') || type.startsWith('UInt')) {
									this.pushCompletionMethods(TDATA.INT)
								} else if (type == 'Float32' || type == 'Float64') {
									this.pushCompletionMethods(TDATA.FLOAT)
								} else if (type == 'Char') {
									this.pushCompletionMethods(TDATA.CHAR)
								} else if (type == 'String') {
									this.pushCompletionMethods(TDATA.STRING)
								} else if (type == 'Symbol') {
									this.pushCompletionMethods(TDATA.SYMBOLS)
								} else if (type.startsWith('Array')) {
									this.pushCompletionMethods(TDATA.ARRAY)
								} else if (type.startsWith('Hash')) {
									this.pushCompletionMethods(TDATA.HASH)
								} else if (type.startsWith('Range')) {
									this.pushCompletionMethods(TDATA.RANGE)
								} else if (type == 'Regex') {
									this.pushCompletionMethods(TDATA.REGEX)
								} else if (type.startsWith('Tuple')) {
									this.pushCompletionMethods(TDATA.TUPLE)
								} else if (type.startsWith('NamedTuple')) {
									this.pushCompletionMethods(TDATA.NAMEDTUPLE)
								} else if (type.startsWith('Proc')) {
									this.pushCompletionMethods(TDATA.PROC)
								}
								// Complete instance methods of Type
								let types = type.split('::')
								let symbolType = types.pop()
								for (let symbol of symbols) {
									if (symbol.containerName == symbolType && !symbol.name.startsWith('self.')) {
										this.createCompletionItem(symbol.name, symbol.containerName, `Instance method of ${type}`, symbol.kind)
									}
								}
								break
							}
						}
					} else if (crystalMessageObject.status == 'disabled') {
						console.error('INFO: crystal instance method completion is disabled')
					}
				} catch (err) {
					console.error('JSON.parse failed to parse crystal context output when completion')
					throw err
				}
			} else if (word.endsWith(':')) {
				// Add SubTypes completion
				for (let symbol of symbols) {
					let symbolType = word.slice(0, -1)
					if (symbol.containerName == symbolType) {
						this.createCompletionItem(symbol.name, symbol.containerName, `Belongs to ${symbolType}`, symbol.kind)
					}
				}
			}
		} else {
			this.pushCompletionMethods(TDATA.TOP_LEVEL)
			// Complete document symbols
			for (let symbol of symbols) {
				this.createCompletionItem(symbol.name, symbol.containerName, "", symbol.kind)
			}
		}
		return this.completions;
	}
}
