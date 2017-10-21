import * as vscode from "vscode"
import * as TDATA from "./crystalCompletionData"

import { CrystalContext } from "./crystalContext"
import { getSymbols } from "./crystalUtils"

/**
 * Completion provider using VSCode module
 */
export class CrystalCompletionItemProvider extends CrystalContext implements vscode.CompletionItemProvider {

	// Completions attribute
	private completions: vscode.CompletionList

	/**
	 * Convert VSCode completion items to symbols
	 */
	private getItemKindFromSymbolKind(kind) {
		switch (kind) {
			case 4:
				return vscode.CompletionItemKind.Class
			case 11:
				return vscode.CompletionItemKind.Function
			case 6:
				return vscode.CompletionItemKind.Property
			case 22:
				return vscode.CompletionItemKind.Struct
			case 1:
				return vscode.CompletionItemKind.Module
			case 9:
				return vscode.CompletionItemKind.Enum
			case 13:
				return vscode.CompletionItemKind.Constant
			case 12:
				return vscode.CompletionItemKind.Variable
			case 5:
				return vscode.CompletionItemKind.Method
			default:
				return 0
		}
	}

	/**
	 * Add a method to completion list
	 */
	private pushCompletionMethods(completions) {
		for (let method of completions) {
			this.createCompletionItem(method[0], method[1], method[2], vscode.SymbolKind.Method)
		}
	}

	/**
	 * Add a symbols to completion list (needed by symbol provider)
	 */
	private pushCompletionOther(completions, kind) {
		for (let completion of completions) {
			this.createCompletionItem(completion[0], completion[1], completion[2], kind)
		}
	}

	/**
	 * Create a new completion item
	 */
	private createCompletionItem(name, detail, documentation, kind) {
		let completion = new vscode.CompletionItem(`${name}`, this.getItemKindFromSymbolKind(kind))
		completion.documentation = documentation
		completion.detail = detail
		completion.sortText = ("0000" + this.completions.items.length).slice(-4)  // <-- from vscode-nim
		this.completions.items.push(completion)
	}

	/**
	 * Return completion data to VSCode
	 */
	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		// -----------------------------------------------
		// TODO: improve Type completion algorithm (again)
		// -----------------------------------------------
		this.completions = new vscode.CompletionList
		const config = vscode.workspace.getConfiguration("crystal-lang")
		if (!config["completion"]) {
			return this.completions
		}
		let line = document.getText(new vscode.Range(position.line, 0, position.line, position.character))
		if (!line) {
			return this.completions
		}
		let comment = line.match(/^[^\"]*#[^\{].*$/)
		let quotes = line.match(/(\")/g)
		if (quotes || comment) { // Check if line isn't a comment or string
			return this.completions
		}
		let column = (position.character > 2) ? (position.character - 2) : 0 // Remove dot or colons and search for a word
		let posDot = new vscode.Position(position.line, column + 1)
		let posColons = new vscode.Position(position.line, column)
		let wordRange = document.getWordRangeAtPosition(posDot) || document.getWordRangeAtPosition(posColons)
		let symbols = await getSymbols(document.uri)
		let completionFlag = false
		if (wordRange) {
			// Check if a call token (.|::) following the word for a method call
			let range = new vscode.Range(wordRange.start.line, wordRange.start.character, wordRange.end.line, wordRange.end.character + 1)
			var word = document.getText(range)
			if (word.endsWith(".")) {
				completionFlag = true
				let container = word.slice(0, -1)
				this.pushCompletionMethods(TDATA.REFLECTION_METHODS) // Add Type reflection
				let symbolsNames = symbols.map((sym) => { return sym.name }) // Create symbols index array
				let staticFound = false // Check static methods for class completion
				let containerIndex = symbolsNames.indexOf(container)
				if (containerIndex >= 0) {
					let containerSymbol = symbols[containerIndex]
					for (let symbol of symbols) {
						if (symbol.name.startsWith("self") && symbol.containerName == containerSymbol.name) {
							staticFound = true
							this.createCompletionItem(symbol.name.slice(5), symbol.containerName, `Belongs to ${word}`, symbol.kind)
						}
					}
					let symbol = symbols[containerIndex]
					if (symbol.kind == vscode.SymbolKind.Class || symbol.kind == vscode.SymbolKind.Struct) {
						staticFound = true
						this.createCompletionItem("new", "new(*args)", `Create a new instance of an Object`, vscode.SymbolKind.Method)
					}
				}
				// ----------------------------------------
				// TODO: Add standard lib method completion
				// ----------------------------------------
				if (!staticFound) {
					if (container == "File") {
						this.pushCompletionMethods(TDATA.FILE_METHODS)
						staticFound = true
					} else if (container == "Dir") {
						this.pushCompletionMethods(TDATA.DIR_METHODS)
						staticFound = true
					}
				}
				if (!staticFound) { // Add instance methods to variables
					let crystalOutput = await this.crystalContext(document, position, "completion")
					if (crystalOutput.toString().startsWith(`{"status":"`)) {
						try {
							let crystalMessageObject = JSON.parse(crystalOutput.toString())
							if (crystalMessageObject.status == "ok") {
								for (let context of crystalMessageObject.contexts) {
									let type = context[container]
									if (type) {
										if (type.endsWith("Nil")) {
											this.pushCompletionMethods(TDATA.NIL_METHODS)
										} else if (type == "Bool") {
											this.pushCompletionMethods(TDATA.BOOL_METHODS)
										} else if (type.startsWith("Int") || type.startsWith("UInt")) {
											this.pushCompletionMethods(TDATA.INT_METHODS)
										} else if (type == "Float32" || type == "Float64") {
											this.pushCompletionMethods(TDATA.FLOAT_METHODS)
										} else if (type == "Char") {
											this.pushCompletionMethods(TDATA.CHAR_METHODS)
										} else if (type == "String") {
											this.pushCompletionMethods(TDATA.STRING_METHODS)
										} else if (type == "Symbol") {
											this.pushCompletionMethods(TDATA.SYMBOLS_METHODS)
										} else if (type.startsWith("Array")) {
											this.pushCompletionMethods(TDATA.ARRAY_METHODS)
										} else if (type.startsWith("Hash")) {
											this.pushCompletionMethods(TDATA.HASH_METHODS)
										} else if (type.startsWith("Range")) {
											this.pushCompletionMethods(TDATA.RANGE_METHODS)
										} else if (type == "Regex") {
											this.pushCompletionMethods(TDATA.REGEX_METHODS)
										} else if (type.startsWith("Tuple")) {
											this.pushCompletionMethods(TDATA.TUPLE_METHODS)
										} else if (type.startsWith("NamedTuple")) {
											this.pushCompletionMethods(TDATA.NAMEDTUPLE_METHODS)
										} else if (type.startsWith("Proc")) {
											this.pushCompletionMethods(TDATA.PROC_METHODS)
										} else if (type.startsWith("Channel")) {
											this.pushCompletionMethods(TDATA.CHANNEL_METHODS)
										}
										// Complete instance methods of Type
										// class String
										//   def tortilla?
										//     self == "tortilla"
										//   end
										// end
										// a = "arepas"
										// a.tortilla?
										let types = type.split("::")
										let symbolType = types.pop()
										for (let symbol of symbols) {
											if (symbol.containerName == symbolType &&
												!symbol.name.startsWith("self.") &&
												!(symbol.name == "initialize") &&
												symbol.kind == vscode.SymbolKind.Function) {
												this.createCompletionItem(symbol.name, symbol.containerName, `Instance method of ${type}`, symbol.kind)
											}
										}
										break
									}
								}
							}
						} catch (err) {
							console.error("ERROR: JSON.parse failed to parse crystal context output when completion")
							throw err
						}
					}
				}
			} else {
				range = new vscode.Range(wordRange.start.line, wordRange.start.character, wordRange.end.line, wordRange.end.character + 2)
				word = document.getText(range)
				if (word.endsWith("::")) {
					completionFlag = true
					let container = word.slice(0, -2)
					// ------------------------------------------
					// TODO: Add standard lib subtypes completion
					// ------------------------------------------
					// if (container == "Char") {
					//   this.pushCompletionOther(TDATA.CHAR_SUBTYPES, vscode.SymbolKind.Struct)
					// }
					// Add SubTypes completion
					for (let symbol of symbols) {
						if (symbol.containerName == container && symbol.kind != vscode.SymbolKind.Function) {
							this.createCompletionItem(symbol.name, symbol.containerName, `Belongs to ${container}`, symbol.kind)
						}
					}
				} else if (word.endsWith(").")) {
					completionFlag = true
					// ---------------------------------------------------------
					// TODO: Do something with chain methods and generic Classes
					// ---------------------------------------------------------
				}
			}
		}
		if (!completionFlag) {
			for (let symbol of symbols) { // Complete document symbols
				if (word) {
					if (symbol.name.startsWith(word.replace(")", ""))) {
						this.createCompletionItem(symbol.name, symbol.containerName, "", symbol.kind)
					}
				} else {
					this.createCompletionItem(symbol.name, symbol.containerName, "", symbol.kind)
				}
			}
			// Complete Top Level Methods
			this.pushCompletionMethods(TDATA.TOP_LEVEL_METHODS)
			// Complete Standard lib
			// ------------------------------------------
			// TODO: Add standard lib types documentation
			// ------------------------------------------
			this.pushCompletionOther(TDATA.STRUCTS, vscode.SymbolKind.Struct)
			this.pushCompletionOther(TDATA.MODULES, vscode.SymbolKind.Module)
			this.pushCompletionOther(TDATA.CLASSES, vscode.SymbolKind.Class)
			this.pushCompletionOther(TDATA.ENUMS, vscode.SymbolKind.Enum)
			this.pushCompletionOther(TDATA.ALIAS, vscode.SymbolKind.Constant)
		}
		return this.completions
	}
}
