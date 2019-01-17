import * as vscode from "vscode"
import * as path from "path"

import { spawnTools, tryWindowsPath } from "./crystalUtils"

/**
 * Show implementations using VSCode provider
 */
export class CrystalImplementationsProvider implements vscode.DefinitionProvider {

	/**
	 * Execute crystal tool context for current file:position
	 */
	crystalImplementations(document: vscode.TextDocument, position: vscode.Position) {
		return spawnTools(document, position, "impl", "implementations")
	}

	/**
	 * Check if position is on local require (ex: require "../json")
	 */
	isLocalRequire(document: vscode.TextDocument, position: vscode.Position, line: String) {
		let match = line.match(/^require\s*"([\.]{1,2}\/.*?)"\s*$/)
		if (!match) {
			return false
		}
		let capture = match.pop()
		let word = document.getText(document.getWordRangeAtPosition(position))
		return capture.indexOf(word) > -1
	}

	/**
	 * Return location of local require
	 */
	getLocalLocation(document: vscode.TextDocument, line: String) {
		let required = line.slice(line.indexOf("\"") + 1, line.lastIndexOf("\""))
		let dir = path.dirname(document.uri.path)
		let expectedUri = vscode.Uri.file(path.join(dir, required + ".cr"))
		return [new vscode.Location(expectedUri, new vscode.Position(0, 0))]
	}

	/**
	 * Search for definitions in a Crystal project
	 */
	async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
		let line = document.lineAt(position.line).text
		if (this.isLocalRequire(document, position, line)) {
			return this.getLocalLocation(document, line);
		}
		let crystalOutput = await this.crystalImplementations(document, position)
		let locations: vscode.Location[] = []
		if (crystalOutput.toString().startsWith(`{"status":"`)) {
			try {
				let crystalMessageObject = JSON.parse(crystalOutput.toString())
				if (crystalMessageObject.status == "ok") {
					for (let element of crystalMessageObject.implementations) {
						let file = tryWindowsPath(element.filename)
						let position = new vscode.Position(element.line - 1, element.column - 1)
						let location = new vscode.Location(vscode.Uri.file(file), position)
						locations.push(location)
					}
				} else if (crystalMessageObject.status == "blocked") {
					console.info("INFO: crystal is taking a moment to check implementation")
				}
			} catch (err) {
				console.error("ERROR: JSON.parse failed to parse crystal implementations output")
				throw err
			}
		}
		return locations
	}
}
