import * as vscode from "vscode"
import { spawn } from "child_process"

import { searchProblemsFromRaw, childOnStd, childOnError } from "./crystalUtils"

/**
 * Formatting provider using VSCode module
 */
export class CrystalFormattingProvider implements vscode.DocumentFormattingEditProvider {

	/**
	 * Execute crystal tool format and get response.
	 * Returns tuple of [stdout, stderr] texts.
	 */
	execFormat(document: vscode.TextDocument) {
		return new Promise<[string, string]>(function (resolve, reject) {
			let responseOut = ""
			let responseErr = ""
			const config = vscode.workspace.getConfiguration("crystal-lang")
			let child = spawn(`${config["compiler"]}`, ["tool", "format", "--no-color", "-"])
			child.stdin.write(document.getText())
			child.stdin.end()
			child.stdout.setEncoding('utf-8')
			childOnError(child)
			child.stdout.on("data", (data) => {
				responseOut += data
			});
			child.stderr.on("data", (data) => {
				responseErr += data
			});
			childOnStd(child, "end", () => {
				return resolve([responseOut, responseErr])
			})
		})
	}

	/**
	 * Return formatted documment to VSCode
	 */
	async provideDocumentFormattingEdits(document: vscode.TextDocument) {
		let response = await this.execFormat(document)
		let responseOut = response[0]
		let responseErr = response[1]
		let textEditData: vscode.TextEdit[] = []

		// OnFly error check is disabled because -f json was removed from crystal, see:
		// https://github.com/crystal-lang/crystal/pull/7257 (this is good reason to migrate to Scry :D)
		// if ((searchProblems(response.toString(), document.uri).length == 0) &&
		// 	response.toString().length > 0) {
		// }

		// QuickFix to replace current code with formated one only if no syntax error is found
		if ((searchProblemsFromRaw(responseErr, document.uri).length == 0) &&
			responseOut.length > 0) {
			let lastLineId = document.lineCount - 1
			let range = new vscode.Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length)
			textEditData = [vscode.TextEdit.replace(range, responseOut)]
		}

		return textEditData
	}
}
