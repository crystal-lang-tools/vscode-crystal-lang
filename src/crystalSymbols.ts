import * as vscode from "vscode"

/**
 * Search document symbols using VSCode provider
 */
export class CrystalDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

	private countEnds: number
	private containers: any[]
	private symbols: vscode.SymbolInformation[]
	private document: vscode.TextDocument

	/**
	 * Create new symbol and append to symbols list
	 */
	newSymbol(name, kind, container, line, matchData) {
		// -------------------
		// TODO: count columns
		// -------------------
		let location = new vscode.Location(this.document.uri, new vscode.Position(line, 0))
		let symbolInfo = new vscode.SymbolInformation(name, kind, container, location)
		this.symbols.push(symbolInfo)
	}

	/**
	 * Set container for current symbol
	 */
	setContainer(matchData) {
		if (this.containers[this.countEnds]) {
			this.containers.pop()
		}
		this.containers.push(matchData)
		this.countEnds += 1
	}

	/**
	 * Increment counter when an assignement expresion is found
	 */
	incrementEndsCountIfKeywordIn(element) {
		const keywords = ["begin", "if", "case", "unless"]
		for (let keyword of keywords) {
			let keyFound = (() => {
				if (keyword == "begin") {
					return new RegExp(keyword + "$").test(element)
				}
				return new RegExp("= " + keyword + " .*$").test(element)
			})()
			if (keyFound) {
				this.countEnds += 1
				break
			}
		}
	}

	/**
	 * Return symbols result to VSCode
	 */
	async provideDocumentSymbols(document: vscode.TextDocument) {
		let matrixText = document.getText().split("\n")
		this.document = document
		this.containers = []
		this.countEnds = 0
		this.symbols = []

		// Search symbol line by line, ignoring comments and empty lines
		for (let [index, element] of matrixText.entries()) {
			let matchData: RegExpMatchArray
			let comment = element.match(/^\s*#.*$/)
			if (comment == null && element != "") {
				if (matchData = element.match(/^\s*(abstract\s+)?(private\s+|protected\s+)?(def|fun) ([^\s\(\)\:]+).*$/)) {
					this.newSymbol(matchData[4], vscode.SymbolKind.Function, this.containers[this.countEnds - 1], index, matchData)
					if (matchData[1] === undefined) {
						this.countEnds += 1
					}
				} else if (matchData = element.match(/^\s*(private\s+)?(macro) ([^\s\(\)\:]+).*$/)) {
					this.newSymbol(matchData[3], vscode.SymbolKind.Function, this.containers[this.countEnds - 1], index, matchData.index)
					this.countEnds += 1
				} else if (matchData = element.match(/^\s*(abstract\s+)?(private\s+)?(class) ([A-Z][^\s\(\)]*).*$/)) {
					this.newSymbol(matchData[4], vscode.SymbolKind.Class, this.containers[this.countEnds - 1], index, matchData.index)
					this.setContainer(matchData[4])
				} else if (matchData = element.match(/^\s*(private\s+|protected\s+)?(class_)?(property|getter|setter)(!|\?)? ([^\s\(\)\:]+).*$/)) {
					this.newSymbol(matchData[5], vscode.SymbolKind.Property, this.containers[this.countEnds - 1], index, matchData.index)
				} else if (matchData = element.match(/^\s*(abstract\s+)?(private\s+)?(struct|record) ([A-Z][^\s\(\)]*).*$/)) {
					this.newSymbol(matchData[4], vscode.SymbolKind.Struct, this.containers[this.countEnds - 1], index, matchData.index)
					if (matchData[1] === undefined && matchData[3] !== "record") {
						this.setContainer(matchData[4])
					}
				} else if (matchData = element.match(/^\s*(private\s+)?(module) ([A-Z][^\s\(\)]*).*$/)) {
					this.newSymbol(matchData[3], vscode.SymbolKind.Module, this.containers[this.countEnds - 1], index, matchData.index)
					this.setContainer(matchData[3])
				} else if (matchData = element.match(/^\s*(private\s+)?(lib) ([A-Z][^\s\(\)\:]*).*$/)) {
					this.newSymbol(matchData[3], vscode.SymbolKind.Module, this.containers[this.countEnds - 1], index, matchData.index)
					this.countEnds += 1
				} else if (matchData = element.match(/^\s*(private\s+)?(enum|union) ([A-Z][^\s\(\)\:]*).*$/)) {
					this.newSymbol(matchData[3], vscode.SymbolKind.Enum, this.containers[this.countEnds - 1], index, matchData.index)
					this.countEnds += 1
				} else if (matchData = element.match(/^\s*(alias\s+|type\s+)?([A-Z][^\s\(\)\:]*)\s*=.*$/)) {
					this.newSymbol(matchData[2], vscode.SymbolKind.Constant, this.containers[this.countEnds - 1], index, matchData.index)
					this.incrementEndsCountIfKeywordIn(element)
				} else if (matchData = element.match(/^\s*(\w[^\@\s\(\)\:]*)\s+:\s+.*$/)) {
					this.newSymbol(matchData[1], vscode.SymbolKind.Variable, this.containers[this.countEnds - 1], index, matchData.index)
				} else if (matchData = element.match(/^\s*(@\w[^\s\(\)\:]*)\s+:\s+.*$/)) {
					this.newSymbol(matchData[1], vscode.SymbolKind.Variable, this.containers[this.countEnds - 1], index, matchData.index)
				} else if (element.match(/^\s*end(\..*)?$/)) {
					this.countEnds -= 1
					if (this.countEnds <= 0) {
						this.containers = []
					}
				} else if (element.match(/^\s*(if|unless|until|while)\s.*$/)) {
					this.countEnds += 1
				} else if (element.match(/^.*=\s+(if|unless)\s.*$/)) {
					this.countEnds += 1
				} else if (element.match(/^\s*(select|case|begin)$/)) {
					this.countEnds += 1
				} else if (element.match(/^.*\sdo(\s\|.*)?$/)) {
					this.countEnds += 1
				} else if (element.match(/^\s*case\s.*$/)) {
					this.countEnds += 1
				} else if (element.match(/^.*\sbegin$/)) {
					this.countEnds += 1
				}
			}
		}
		return this.symbols
	}
}