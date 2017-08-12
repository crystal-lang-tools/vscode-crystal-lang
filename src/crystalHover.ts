import * as vscode from "vscode"
import * as TDATA from "./crystalCompletionData"
import { CrystalContext } from "./crystalContext"
import { isNotKeyword, isNotLib, getSymbols } from "./crystalUtils"

const TYPES = [
	TDATA.REFLECTION_METHODS, TDATA.NIL_METHODS, TDATA.BOOL_METHODS, TDATA.INT_METHODS,
	TDATA.FLOAT_METHODS, TDATA.CHAR_METHODS, TDATA.STRING_METHODS, TDATA.SYMBOLS_METHODS, TDATA.ARRAY_METHODS,
	TDATA.HASH_METHODS, TDATA.RANGE_METHODS, TDATA.REGEX_METHODS, TDATA.TUPLE_METHODS, TDATA.NAMEDTUPLE_METHODS,
	TDATA.PROC_METHODS, TDATA.FILE_METHODS, TDATA.TOP_LEVEL_METHODS, TDATA.STRUCTS, TDATA.CLASSES,
	TDATA.MODULES, TDATA.ALIAS, TDATA.ENUMS
]

export class CrystalHoverProvider extends CrystalContext implements vscode.HoverProvider {

	async provideHover(document: vscode.TextDocument, position: vscode.Position, token) {
		const config = vscode.workspace.getConfiguration("crystal-lang")
		if (!config["hover"]) {
				return
		}
		let line = document.getText(new vscode.Range(position.line, 0, position.line, position.character))
		// Check if line isn"t a comment or string
		let quotes = null
		let comment = null
		if (line) {
			quotes = line.match(/(\")/g)
			comment = line.match(/^[^\"]*#.*$/)
		}
		if (quotes == null && comment == null) {
			let stop = false
			let range = document.getWordRangeAtPosition(new vscode.Position(position.line, position.character))
			if (range) {
				let word = document.getText(range)
				if (isNotKeyword(word) && word.toLowerCase() == word && !parseInt(word)) {
					// Checks for variables using context tool
					let crystalOutput = await this.crystalContext(document, position, "hover")
					if (crystalOutput.toString().startsWith(`{"status":"`)) {
						try {
							let crystalMessageObject = JSON.parse(crystalOutput.toString())
							if (crystalMessageObject.status == "ok") {
								for (let element of crystalMessageObject.contexts) {
									let type = element[word]
									if (type) {
										return new vscode.Hover(`${word} : ${type}`)
									}
								}
							} else if (crystalMessageObject.status != "failed") {
								stop = true
							}
						} catch (err) {
							stop = true
							console.error("ERROR: JSON.parse failed to parse crystal context output when hover")
							throw err
						}
					}
				}
				if (isNotKeyword(word) && !parseInt(word) && !stop) {
					// Checks Symbols
					let symbols = await getSymbols(document.uri)
					for (let symbol of symbols) {
						if (symbol.name == word) {
							let container = symbol.containerName ? ` of ${symbol.containerName}` : ""
							return new vscode.Hover({
								language: "plaintext",
								value: `${vscode.SymbolKind[symbol.kind]} ${symbol.name}${container}`
							})
						}
					}
					// Checks Completion data
					let hoverTexts = []
					for (let type of TYPES) {
						for (let element of type) {
							if (element[0] == word) {
								hoverTexts.push({
									language: "crystal",
									value: `${element[1]}`
								})
								if (element[2] !== "") {
									hoverTexts.push({
										language: "plaintext",
										value: `${element[2]}`
									})
								}
							}
						}
					}
					// -------------------------------
					// TODO: Improve hover information
					// -------------------------------
					return new vscode.Hover(this.filter(hoverTexts))
				}
			}
		}
	}

	// Remove duplicate methods and descriptions.
	filter(hoverTexts: any[]) {
		if (hoverTexts.length <= 1) {
			return hoverTexts
		}
		let prev = false
		return hoverTexts.filter((item, index, self) => {
			if (index % 2 == 0) {
				let objectIndex = self.findIndex((t) => {
					return t.value == item.value
				})
				let nextObjectIndex = self.findIndex((t) => {
					if (self[index + 1] == undefined) {
						return false
					} else {
						return t.value == self[index + 1].value
					}
				})
				prev = objectIndex == index && nextObjectIndex == index + 1
				return prev
			} else {
				return prev
			}
		})
	}
}
