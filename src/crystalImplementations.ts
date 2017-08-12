import * as vscode from "vscode"
import { dirname } from "path"

import { CrystalProblemsFinder } from "./crystalProblemsFinder"
import { spawnPromise } from "./crystalUtils"

export class CrystalImplementationsProvider extends CrystalProblemsFinder implements vscode.DefinitionProvider {

	/**
	 * Execute crystal tool context for current file:position
	 * and do syntax checking too if enabled.
	 */
	crystalImplementations(document: vscode.TextDocument, position: vscode.Position) {
		return spawnPromise(document, position, "impl", "implementations", this.searchProblems)
	}

	async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
		let crystalOutput = await this.crystalImplementations(document, position)
		let locations: vscode.Location[] = []
		if (crystalOutput.toString().startsWith(`{"status":"`)) {
			try {
				let crystalMessageObject = JSON.parse(crystalOutput.toString())
				if (crystalMessageObject.status == "ok") {
					for (let element of crystalMessageObject.implementations) {
						let position = new vscode.Position(element.line - 1, element.column - 1)
						let location = new vscode.Location(vscode.Uri.file(element.filename), position)
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
