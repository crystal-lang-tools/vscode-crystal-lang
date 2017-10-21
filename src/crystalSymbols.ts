import * as vscode from "vscode"

/**
 * Search document symbols using VSCode provider
 */
export class CrystalDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

	// Return symbols result to VSCode
	async provideDocumentSymbols(document: vscode.TextDocument) {

		let containers = []
		let countEnds = 0
		let symbols: vscode.SymbolInformation[] = []
		let matrixText = document.getText().split("\n")

		// Create new symbol and append to symbols list
		function newSymbol(name, kind, container, line, matchData) {
			// -------------------
			// TODO: count columns
			// -------------------
			let location = new vscode.Location(document.uri, new vscode.Position(line, 0))
			let symbolInfo = new vscode.SymbolInformation(name, kind, container, location)
			symbols.push(symbolInfo)
		}

		// Set container for current symbol
		function setContainer(matchData) {
			if (containers[countEnds]) {
				containers.pop()
			}
			containers.push(matchData)
			countEnds += 1
		}

		// Increment counter when an assignement expresion is found
		function incrementEndsCountIfKeywordIn(element) {
			const keywords = ["begin", "if", "case", "unless"]
			for (let keyword of keywords) {
				let keyFound = (() => {
					if (keyword == "begin") {
						return new RegExp(keyword + "$").test(element)
					}
					return new RegExp("= " + keyword + " .*$").test(element)
				})()
				if (keyFound) {
					countEnds += 1
					break
				}
			}
		}

		// Search symbol line by line, ignoring comments and empty lines
		for (let [index, element] of matrixText.entries()) {
			let matchData: RegExpMatchArray
			let comment = element.match(/^\s*#.*$/)
			if (comment == null && element != "") {
				if (matchData = element.match(/^\s*(abstract\s+)?(private\s+|protected\s+)?(def|fun) ([^\s\(\)\:]+).*$/)) {
					newSymbol(matchData[4], vscode.SymbolKind.Function, containers[countEnds - 1], index, matchData)
					if (matchData[1] === undefined) {
						countEnds += 1
					}
				} else if (matchData = element.match(/^\s*(private\s+)?(macro) ([^\s\(\)\:]+).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Function, containers[countEnds - 1], index, matchData.index)
					countEnds += 1
				} else if (matchData = element.match(/^\s*(abstract\s+)?(private\s+)?(class) ([A-Z][^\s\(\)]*).*$/)) {
					newSymbol(matchData[4], vscode.SymbolKind.Class, containers[countEnds - 1], index, matchData.index)
					setContainer(matchData[4])
				} else if (matchData = element.match(/^\s*(private\s+|protected\s+)?(class_)?(property|getter|setter)(!|\?)? ([^\s\(\)\:]+).*$/)) {
					newSymbol(matchData[5], vscode.SymbolKind.Property, containers[countEnds - 1], index, matchData.index)
				} else if (matchData = element.match(/^\s*(abstract\s+)?(private\s+)?(struct|record) ([A-Z][^\s\(\)]*).*$/)) {
					newSymbol(matchData[4], vscode.SymbolKind.Struct, containers[countEnds - 1], index, matchData.index)
					if (matchData[1] === undefined && matchData[3] !== "record") {
						setContainer(matchData[4])
					}
				} else if (matchData = element.match(/^\s*(private\s+)?(module) ([A-Z][^\s\(\)]*).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Module, containers[countEnds - 1], index, matchData.index)
					setContainer(matchData[3])
				} else if (matchData = element.match(/^\s*(private\s+)?(lib) ([A-Z][^\s\(\)\:]*).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Module, containers[countEnds - 1], index, matchData.index)
					countEnds += 1
				} else if (matchData = element.match(/^\s*(private\s+)?(enum|union) ([A-Z][^\s\(\)\:]*).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Enum, containers[countEnds - 1], index, matchData.index)
					countEnds += 1
				} else if (matchData = element.match(/^\s*(alias\s+|type\s+)?([A-Z][^\s\(\)\:]*)\s*=.*$/)) {
					newSymbol(matchData[2], vscode.SymbolKind.Constant, containers[countEnds - 1], index, matchData.index)
					incrementEndsCountIfKeywordIn(element)
				} else if (matchData = element.match(/^\s*(\w[^\@\s\(\)\:]*)\s+:\s+.*$/)) {
					newSymbol(matchData[1], vscode.SymbolKind.Variable, containers[countEnds - 1], index, matchData.index)
				} else if (matchData = element.match(/^\s*(@\w[^\s\(\)\:]*)\s+:\s+.*$/)) {
					newSymbol(matchData[1], vscode.SymbolKind.Variable, containers[countEnds - 1], index, matchData.index)
				} else if (element.match(/^\s*end(\..*)?$/)) {
					countEnds -= 1
					if (countEnds <= 0) {
						containers = []
					}
				} else if (element.match(/^\s*(if|unless|until|while)\s.*$/)) {
					countEnds += 1
				} else if (element.match(/^.*=\s+(if|unless)\s.*$/)) {
					countEnds += 1
				} else if (element.match(/^\s*(select|case|begin)$/)) {
					countEnds += 1
				} else if (element.match(/^.*\sdo(\s\|.*)?$/)) {
					countEnds += 1
				} else if (element.match(/^\s*case\s.*$/)) {
					countEnds += 1
				} else if (element.match(/^.*\sbegin$/)) {
					countEnds += 1
				}
			}
		}

		return symbols
	}
}