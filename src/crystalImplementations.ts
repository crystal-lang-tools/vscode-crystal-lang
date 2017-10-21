import * as vscode from "vscode"
import { dirname } from "path"

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
	 * Search for definitions in a Crystal project
	 */
	async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
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
