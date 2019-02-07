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
			let child = spawn(`${config["compiler"]}`, ["tool", "format", "--no-color", "-"])
			child.stdin.write(document.getText())
			child.stdin.end()
			childOnError(child)
			childOnStd(child, "data", (data) => {
				response += data
			})
			childOnStd(child, "end", () => {
				return resolve(response)
			})
		})
	}

	/**
	 * Return formatted documment to VSCode
	 */
	async provideDocumentFormattingEdits(document: vscode.TextDocument) {
		let response = await this.execFormat(document)
		let textEditData: vscode.TextEdit[] = []

		// OnFly error check is disabled because -f json was removed from crystal, see:
		// https://github.com/crystal-lang/crystal/pull/7257 (this is good reason to migrate to Scry :D)
		// if ((searchProblems(response.toString(), document.uri).length == 0) &&
		// 	response.toString().length > 0) {
		// }

		// QuickFix to replace current code with formated one only if no syntax error is found
		if (!response.toString().startsWith("Syntax error in ")) {
			let lastLineId = document.lineCount - 1
			let range = new vscode.Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length)
			textEditData = [vscode.TextEdit.replace(range, response.toString())]
	
			return textEditData
		}
	}
}
