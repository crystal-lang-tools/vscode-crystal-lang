import * as vscode from 'vscode'

import { isNotLib } from "./crystalConfiguration"

/**
 * Error output format by crystal -f json
 */
interface CrystalError {
	file: string
	size: number
	line: number
	column: number
	message: string
}

export const diagnosticCollection = vscode.languages.createDiagnosticCollection('crystal')

export class CrystalProblemsFinder {

	/**
	 * Parse JSON response and create diagnostics.
	 */
	searchProblems(response: string, uri: vscode.Uri) {
		let diagnostics = []
		const config = vscode.workspace.getConfiguration('crystal-lang')
		if (response.startsWith('[{"file":"')) {
			try {
				let results: CrystalError[] = JSON.parse(response)
				let maxNumberOfProblems = config['maxNumberOfProblems']
				for (let [index, problem] of results.entries()) {
					if (index >= maxNumberOfProblems) {
						break
					}
					let range = new vscode.Range(problem.line - 1, problem.column - 1, problem.line - 1, (problem.column + (problem.size || 0) - 1))
					let diagnostic = new vscode.Diagnostic(range, problem.message, vscode.DiagnosticSeverity.Error)
					let file: vscode.Uri
					if (problem.file.length > 0) {
						if (!problem.file.endsWith('.cr')) {
							file = vscode.Uri.file(vscode.workspace.rootPath + '/' + problem.file)
						} else {
							file = vscode.Uri.file(problem.file)
						}
					} else {
						file = uri
					}
					diagnostics.push([file, [diagnostic]])
				}
			} catch (err) {
				// console.error(response)
				console.error('ERROR: JSON.parse failed to parse crystal output')
				throw err
			}
		} else {
			diagnosticCollection.clear()
		}
		if (config['problems'] !== 'none') {
			diagnosticCollection.set(diagnostics)
		}
		return diagnostics
	}
}