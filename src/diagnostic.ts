'use strict';
import { Diagnostic, DiagnosticSeverity, Range, TextDocument, Uri } from 'vscode';
import { languages, workspace } from 'vscode';
import { exec } from 'child_process';

/**
 * Execute crystal build and get response.
 * @param document TextDocument
 */
function documentDiagnostic(document: TextDocument) {
	let fileName = document.fileName;
	let config = workspace.getConfiguration('crystal-lang');
	let problemsLimit = config['problemsLimit'];

	if (config['problems'] !== true) { return; }

	if (config['mainFile'] !== "") { fileName = config['mainFile']; }

	if (document.uri['_formatted'].startsWith('file:')) {
		exec(`crystal build --no-color --no-codegen -f json "${fileName}"`, (err, response) => {
			responseDiagnostics(response, document.uri);
		})
	}
}

interface CrystalError {
	file: string;
	size: number;
	line: number;
	column: number;
	message: string;
}

/**
 * Parse JSON response and create diagnostics.
 * @param response string
 * @param uri Uri
 */
export function responseDiagnostics(response: string, uri: Uri) {
	let diagnostics = [];
	let problemsLimit = workspace.getConfiguration('crystal-lang')['problemsLimit'];
	diagnosticCollection.clear();

	if (response.startsWith("[{\"file\":\"")) {
		let results: CrystalError[] = JSON.parse(response);
		let length = Math.min(problemsLimit, results.length);
		for (let problemNumber = 0; problemNumber < length; problemNumber += 1) {
			let problem = results[problemNumber];
			let range = new Range(problem.line - 1, problem.column - 1, problem.line - 1, (problem.column + (problem.size || 0) - 1));
			let diagnostic = new Diagnostic(range, problem.message, DiagnosticSeverity.Error);
			let file: Uri;
			if (problem.file.length > 0) {
				file = Uri.file(problem.file);
			} else {
				file = Uri.parse(uri['_formatted']);
			}
			diagnostics.push([file, [diagnostic]]);
		}
	}

	diagnosticCollection.set(diagnostics);
	return diagnostics;
}

export const diagnosticCollection = languages.createDiagnosticCollection('crystal');

export const diagnosticOnOpen = workspace.onDidOpenTextDocument((document: TextDocument) => {
	if (document.languageId === 'crystal') {
		documentDiagnostic(document);
	}
});

export const diagnosticOnSave = workspace.onDidSaveTextDocument((document: TextDocument) => {
	if (document.languageId === 'crystal') {
		documentDiagnostic(document);
	}
});
