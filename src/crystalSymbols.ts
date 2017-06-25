import * as vscode from 'vscode'

export class CrystalDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

	/**
	 * Search document symbols
	 */
	async provideDocumentSymbols(document: vscode.TextDocument) {
		let symbols: vscode.SymbolInformation[] = []
		let matrixText = document.getText().split('\n')
		function newSymbol(name, kind, container, line, matchData) {
			// -------------------
			// TODO: count columns
			// -------------------
			let location = new vscode.Location(document.uri, new vscode.Position(line, 0))
			let symbolInfo = new vscode.SymbolInformation(name, kind, container, location)
			symbols.push(symbolInfo)
		}
		let Containers = []
		let countEnds = 0
		function setContainer(matchData) {
			if (Containers[countEnds]) {
				Containers.pop()
			}
			Containers.push(matchData)
			countEnds += 1
		}
		for (let [index, element] of matrixText.entries()) {
			let matchData: RegExpMatchArray
			let comment = element.match(/^\s*#.*$/)
			if (comment == null && element != '') {
				if (matchData = element.match(/^\s*(abstract\s+)?(private\s+|protected\s+)?(def) ([^\s\()]+).*$/)) {
					newSymbol(matchData[4], vscode.SymbolKind.Function, Containers[countEnds - 1], index, matchData)
					if (matchData[1] === undefined) {
						countEnds += 1
					}
				} else if (matchData = element.match(/^\s*(private\s+)?(macro) (\w+).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Function, Containers[countEnds - 1], index, matchData.index)
					countEnds += 1
				} else if (matchData = element.match(/^\s*(abstract\s+)?(private\s+)?(class) ([A-Z]\w*).*$/)) {
					newSymbol(matchData[4], vscode.SymbolKind.Class, Containers[countEnds - 1], index, matchData.index)
					setContainer(matchData[4])
				} else if (matchData = element.match(/^\s*(class_)?(property|getter|setter)(!|\?)? ([:\'\w]+).*$/)) {
					newSymbol(matchData[4], vscode.SymbolKind.Property, Containers[countEnds - 1], index, matchData.index)
				} else if (matchData = element.match(/^\s*(abstract\s+)?(private\s+)?(struct|record) ([A-Z]\w+).*$/)) {
					newSymbol(matchData[4], vscode.SymbolKind.Struct, Containers[countEnds - 1], index, matchData.index)
					if (matchData[1] === undefined && matchData[3] !== 'record') {
						setContainer(matchData[4])
					}
				} else if (matchData = element.match(/^\s*(private\s+)?(module) ([A-Z]\w+).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Module, Containers[countEnds - 1], index, matchData.index)
					setContainer(matchData[3])
				} else if (matchData = element.match(/^\s*(private\s+)?(lib) ([A-Z]\w+).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Module, Containers[countEnds - 1], index, matchData.index)
					countEnds += 1
				} else if (matchData = element.match(/^\s*(private\s+)?(enum|union) ([A-Z]\w+).*$/)) {
					newSymbol(matchData[3], vscode.SymbolKind.Enum, Containers[countEnds - 1], index, matchData.index)
					countEnds += 1
				} else if (matchData = element.match(/^\s*([A-Z]\w+)\s*=.*$/)) {
					newSymbol(matchData[1], vscode.SymbolKind.Constant, Containers[countEnds - 1], index, matchData.index)
					if (element.endsWith('begin')) {
						countEnds +=1
					}
				} else if (matchData = element.match(/^\s*(\w+)\s+:\s+.*$/)) {
					newSymbol(matchData[1], vscode.SymbolKind.Variable, Containers[countEnds - 1], index, matchData.index)
				} else if (element.match(/^\s*end(\..*)?$/)) {
					countEnds -= 1
					if (countEnds <= 0) {
						Containers = []
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