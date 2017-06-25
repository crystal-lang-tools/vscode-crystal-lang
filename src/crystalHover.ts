import * as vscode from 'vscode'
import { CrystalContext } from './crystalContext'

export class CrystalHoverProvider extends CrystalContext implements vscode.HoverProvider {

	public currentLine
	public crystalOutput
	public crystalMessageObject

	constructor() {
		super()
		this.currentLine = -1
		this.crystalOutput = ''
		this.crystalMessageObject = {}
	}

	async provideHover(document: vscode.TextDocument, position: vscode.Position, token) {
		if (this.currentLine != position.line) {
			try {
				this.crystalOutput = await this.crystalContext(document, position, 'types')
				this.crystalMessageObject = JSON.parse(this.crystalOutput.toString())
				this.currentLine = position.line
			} catch (err) {
				console.error('ERROR: JSON.parse failed to parse crystal context output when hover')
				throw err
			}
		}
		if (this.crystalMessageObject.status == 'ok') {
			let range = document.getWordRangeAtPosition(new vscode.Position(position.line, position.character))
			if (range) {
				let word = document.getText(range)
				for (let element of this.crystalMessageObject.contexts) {
					let type = element[word]
					if (type) {
						return new vscode.Hover(`${word} : ${type}`)
					}
				}
			}
		} else if (this.crystalMessageObject.status == 'disabled') {
			console.error('INFO: crystal context on hover is disabled')
		}
	}
}
