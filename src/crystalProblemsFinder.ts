import * as vscode from 'vscode'

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
		let config = vscode.workspace.getConfiguration('crystal-lang')
		if (response.startsWith('[{"file":"') && config['problems'] !== 'none') {
			try {
				let results: CrystalError[] = JSON.parse(response)
				let maxNumberOfProblems = config['maxNumberOfProblems']
				let length = Math.min(maxNumberOfProblems, results.length)
				for (let problem of results) {
					if (!problem.file.startsWith('/usr/lib') && !problem.file.startsWith(`${vscode.workspace.rootPath}/lib`)) {
						let range = new vscode.Range(problem.line - 1, problem.column - 1, problem.line - 1, (problem.column + (problem.size || 0) - 1))
						let diagnostic = new vscode.Diagnostic(range, problem.message, vscode.DiagnosticSeverity.Error)
						let file: vscode.Uri
						if (problem.file.length > 0) {
							file = vscode.Uri.file(problem.file)
						} else {
							file = uri
						}
						diagnostics.push([file, [diagnostic]])
					}
				}
			} catch (err) {
				console.error('ERROR: JSON.parse failed to parse crystal output')
				throw err
			}
		} else {
			diagnosticCollection.clear()
		}
		diagnosticCollection.set(diagnostics)
		return diagnostics
	}
}