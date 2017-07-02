import * as vscode from 'vscode'
import * as TDATA from './crystalCompletionData'
import { CrystalContext } from './crystalContext'
import { platform } from "os"

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

	private pushCompletionOther(completions, kind) {
		for (let completion of completions) {
			this.createCompletionItem(completion[0], completion[1], completion[2], kind)
		}
	}

	private createCompletionItem(name, detail, documentation, kind) {
		let completion = new vscode.CompletionItem(`${name}`, this.getItemKindFromSymbolKind(kind))
		completion.documentation = documentation
		completion.detail = detail
		completion.sortText = ('0000' + this.completions.items.length).slice(-4)  // <-- Taked from vscode-nim
		this.completions.items.push(completion)
	}

	private getSymbols(uri): Thenable<vscode.SymbolInformation[]> {
		return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri)
	}

	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		// -----------------------------------------------
		// TODO: improve Type completion algorithm (again)
		// -----------------------------------------------
		this.completions = new vscode.CompletionList
		// Remove dot or colons and search for a word
		let column = (position.character > 2) ? (position.character - 2) : 0
		let posDot = new vscode.Position(position.line, column + 1)
		let posColons = new vscode.Position(position.line, column)
		let wordRange = document.getWordRangeAtPosition(posDot) || document.getWordRangeAtPosition(posColons)
		let symbols = await this.getSymbols(document.uri)
		let completionFlag = false
		if (wordRange) {
			// Check if a call token (.|::) follow the word for a method call
			let range = new vscode.Range(wordRange.start.line, wordRange.start.character, wordRange.end.line, wordRange.end.character + 1)
			var word = document.getText(range)
			if (word.endsWith('.')) {
				completionFlag = true
				try {
					let container = word.slice(0, -1)
					// Add Type reflection
					this.pushCompletionMethods(TDATA.REFLECTION_METHODS)
					// Add static methods to Types completion
					let staticFound = false
					for (let symbol of symbols) {
						if (symbol.containerName == container) {
							if (symbol.name.startsWith('self')) {
								staticFound = true
								this.createCompletionItem(symbol.name.slice(5), symbol.containerName, `Belongs to ${word}`, symbol.kind)
							} else if (symbol.name == 'initialize') {
								staticFound = true
								this.createCompletionItem("new", "(class method) new(*args)", `Create a new instance of an Object`, vscode.SymbolKind.Method)
							}
						}
					}
					// ----------------------------------------
					// TODO: Add standard lib method completion
					// ----------------------------------------
					if (!staticFound) {
						if (container == 'File') {
							this.pushCompletionMethods(TDATA.FILE_METHODS)
							staticFound = true
						}
					}

					// Add instance methods to variables (Don't works on windows yet)
					if (!staticFound) {
						if (platform() != 'win32') {
							let crystalOutput = await this.crystalContext(document, position, 'completion')
							let crystalMessageObject = JSON.parse(crystalOutput.toString())
							if (crystalMessageObject.status == "ok") {
								for (let context of crystalMessageObject.contexts) {
									let type = context[container]
									if (type) {
										if (type.endsWith('Nil')) {
											this.pushCompletionMethods(TDATA.NIL_METHODS)
										} else if (type == 'Bool') {
											this.pushCompletionMethods(TDATA.BOOL_METHODS)
										} else if (type.startsWith('Int') || type.startsWith('UInt')) {
											this.pushCompletionMethods(TDATA.INT_METHODS)
										} else if (type == 'Float32' || type == 'Float64') {
											this.pushCompletionMethods(TDATA.FLOAT_METHODS)
										} else if (type == 'Char') {
											this.pushCompletionMethods(TDATA.CHAR_METHODS)
										} else if (type == 'String') {
											this.pushCompletionMethods(TDATA.STRING_METHODS)
										} else if (type == 'Symbol') {
											this.pushCompletionMethods(TDATA.SYMBOLS_METHODS)
										} else if (type.startsWith('Array')) {
											this.pushCompletionMethods(TDATA.ARRAY_METHODS)
										} else if (type.startsWith('Hash')) {
											this.pushCompletionMethods(TDATA.HASH_METHODS)
										} else if (type.startsWith('Range')) {
											this.pushCompletionMethods(TDATA.RANGE_METHODS)
										} else if (type == 'Regex') {
											this.pushCompletionMethods(TDATA.REGEX_METHODS)
										} else if (type.startsWith('Tuple')) {
											this.pushCompletionMethods(TDATA.TUPLE_METHODS)
										} else if (type.startsWith('NamedTuple')) {
											this.pushCompletionMethods(TDATA.NAMEDTUPLE_METHODS)
										} else if (type.startsWith('Proc')) {
											this.pushCompletionMethods(TDATA.PROC_METHODS)
										}
										// Complete instance methods of Type
										// class String
										//   def tortilla?
										//     self == "tortilla"
										//   end
										// end
										// a = "arepas"
										// a.tortilla?
										let types = type.split('::')
										let symbolType = types.pop()
										for (let symbol of symbols) {
											if (symbol.containerName == symbolType && !symbol.name.startsWith('self.') && !(symbol.name == 'initialize')) {
												this.createCompletionItem(symbol.name, symbol.containerName, `Instance method of ${type}`, symbol.kind)
											}
										}
										break
									}
								}
							} else if (crystalMessageObject.status == 'blocked') {
								// console.info('INFO: crystal is taking a moment to check context when completion')
							} else if (crystalMessageObject.status == 'disabled') {
								// console.info('INFO: crystal instance method completion is disabled')
							}
						} else {
							// console.info("INFO: instance method completion isn't avaliable on Windows yet")
						}
					}
				} catch (err) {
					console.error('ERROR: JSON.parse failed to parse crystal context output when completion')
					throw err
				}
			} else {
				range = new vscode.Range(wordRange.start.line, wordRange.start.character, wordRange.end.line, wordRange.end.character + 2)
				word = document.getText(range)
				if (word.endsWith('::')) {
					completionFlag = true
					let container = word.slice(0, -2)
					// ------------------------------------------
					// TODO: Add standard lib subtypes completion
					// ------------------------------------------
					// if (container == 'Char') {
					// 	this.pushCompletionOther(TDATA.CHAR_SUBTYPES, vscode.SymbolKind.Struct)
					// }
					// Add SubTypes completion
					for (let symbol of symbols) {
						if (symbol.containerName == container && symbol.kind != vscode.SymbolKind.Function) {
							this.createCompletionItem(symbol.name, symbol.containerName, `Belongs to ${container}`, symbol.kind)
						}
					}
				} else if (word.endsWith(').')) {
					completionFlag = true
					// ---------------------------------------------------------
					// TODO: Do something with chain methods and generic Classes
					// ---------------------------------------------------------
				}
			}
		}
		if (!completionFlag) {
			let line = document.getText(new vscode.Range(position.line, 0, position.line, position.character))
			// Check if line isn't a comment or string
			let quotes = null
			let comment = null
			if (line) {
				quotes = line.match(/(\")/g)
				comment = line.match(/^[^\"]*#.*$/)
			}
			if (quotes == null && comment == null) {
				// Complete document symbols
				for (let symbol of symbols) {
					if (word) {
						if (symbol.name.startsWith(word.replace(')', ''))) {
							this.createCompletionItem(symbol.name, symbol.containerName, '', symbol.kind)
						}
					} else {
							this.createCompletionItem(symbol.name, symbol.containerName, '', symbol.kind)
					}
				}
				if (!wordRange) {
					// Complete Top Level Methods
					this.pushCompletionMethods(TDATA.TOP_LEVEL_METHODS)
					// Complete Standard lib
					// ------------------------------------------
					// TODO: Add standard lib types documentation
					// ------------------------------------------
					this.pushCompletionOther(TDATA.STRUCTS, vscode.SymbolKind.Struct)
					this.pushCompletionOther(TDATA.CLASSES, vscode.SymbolKind.Class)
					this.pushCompletionOther(TDATA.MODULES, vscode.SymbolKind.Module)
					this.pushCompletionOther(TDATA.ENUMS, vscode.SymbolKind.Enum)
					this.pushCompletionOther(TDATA.ALIAS, vscode.SymbolKind.Constant)
				}
			}
		}
		return this.completions
	}
}
