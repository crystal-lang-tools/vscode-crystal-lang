'use strict';
import { Diagnostic, DiagnosticSeverity, Range, TextDocument, Uri } from 'vscode';
import { languages, workspace } from 'vscode';
import { exec, spawn } from 'child_process';

interface CrystalError {
	file: string;
	size: number;
	line: number;
	column: number;
	message: string;
}

export class CrystalDiagnostic {

	/**
	 * Amount of crystal processes running in parallel
	 */
	private processes: number[];
	private config;

	constructor() {
		this.processes = [];
		this.config = workspace.getConfiguration('crystal-lang');
	}

	/**
	 * Execute crystal build and get response.
	 */
	documentDiagnostic(document: TextDocument) {

		let fileName = (this.config['mainFile'] !== "") ? this.config['mainFile'] : document.fileName;

		if (this.config['problems'] === "syntax") {
			// Use lightweight syntax check provided by crystal tool format
			let dataStorage = "";
			let child = spawn('crystal', ['tool', 'format', '--check', '--no-color', '-f', 'json', '-']);
			child.stdin.write(document.getText());
			child.stdin.end();
			child.stdout.on('data', (data) => {
				dataStorage += data;
			});
			child.stdout.on('end', (data) => {
				this.responseDiagnostics(dataStorage, document.uri);
			});
			child.on('error', (error) => {
				console.error(error);
			});
		} else if (this.config['problems'] === "build" && document.uri['_formatted'].startsWith('file:') && this.processes.length < 3) {
			let env = {
				env: {
					'CRYSTAL_PATH': `${workspace.rootPath}/lib:/usr/lib/crystal`
				}
			}
			this.processes.push(1)
			exec(`crystal build --no-debug --no-codegen --error-trace -f json "${fileName}"`, env, (err, response) => {
				if (err) {
					console.error(err);
				}
				this.processes.pop();
				this.responseDiagnostics(response, document.uri);
			})
		}
	}

	/**
	 * Parse JSON response and create diagnostics.
	 */
	responseDiagnostics(response: string, uri: Uri) {
		let diagnostics = [];
		let problemsLimit = this.config['problemsLimit'];
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
}

export const diagnosticCollection = languages.createDiagnosticCollection('crystal');

export const crystalDiagnostic = new CrystalDiagnostic();

export const diagnosticOnOpen = workspace.onDidOpenTextDocument((document: TextDocument) => {
	if (document.languageId === 'crystal') {
		crystalDiagnostic.documentDiagnostic(document);
	}
});

export const diagnosticOnSave = workspace.onDidSaveTextDocument((document: TextDocument) => {
	if (document.languageId === 'crystal') {
		crystalDiagnostic.documentDiagnostic(document);
	}
});
