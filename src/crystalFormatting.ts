import * as vscode from "vscode"
import { spawn } from "child_process"

import { searchProblems, childOnStd, childOnError } from "./crystalUtils"

/**
 * Formatting provider using VSCode module
 */
export class CrystalFormattingProvider implements vscode.DocumentFormattingEditProvider {

	/**
	 * Execute crystal tool format and get response.
	 */
	execFormat(document: vscode.TextDocument) {
		return new Promise(function (resolve, reject) {
			let response = ""
			const config = vscode.workspace.getConfiguration("crystal-lang")
			let child = spawn(`${config["compiler"]}`, ["tool", "format", "--no-color", "-f", "json", "-"])
			child.stdin.write(document.getText())
			child.stdin.end()
			childOnStd(child, "data", (data) => {
				response += data
			})
			childOnStd(child, "end", () => {
				return resolve(response)
			})
			childOnError(child)
		})
	}

	/**
	 * Return formatted documment to VSCode
	 */
	async provideDocumentFormattingEdits(document: vscode.TextDocument) {
		let response = await this.execFormat(document)
		let textEditData: vscode.TextEdit[] = []

		if ((searchProblems(response.toString(), document.uri).length == 0) &&
			response.toString().length > 0) {
			let lastLineId = document.lineCount - 1
			let range = new vscode.Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length)
			textEditData = [vscode.TextEdit.replace(range, response.toString())]
		}

		return textEditData
	}
}
