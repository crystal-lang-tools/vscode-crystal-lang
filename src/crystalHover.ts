import * as vscode from 'vscode'
import { CrystalContext } from './crystalContext'

export class CrystalHoverProvider extends CrystalContext implements vscode.HoverProvider {

	async provideHover(document: vscode.TextDocument, position: vscode.Position, token) {
		let crystalOutput = await this.crystalContext(document, position, 'types')
		try {
			let crystalMessageObject = JSON.parse(crystalOutput.toString())
			if (crystalMessageObject.status == 'ok') {
				let range = document.getWordRangeAtPosition(new vscode.Position(position.line, position.character))
				if (range) {
					let word = document.getText(range)
					for (let element of crystalMessageObject.contexts) {
						let type = element[word]
						if (type) {
							return new vscode.Hover(`${word} : ${type}`)
						}
					}
				}
			} else if (crystalMessageObject.status == 'blocked') {
				// console.info('INFO: crystal is taking a moment to check type on hover')
			} else if (crystalMessageObject.status == 'disabled') {
				// console.info('INFO: crystal context on hover is disabled')
			}
		} catch (err) {
			// console.error(crystalOutput.toString())
			console.error('ERROR: JSON.parse failed to parse crystal context output when hover')
			throw err
		}
	}
}
