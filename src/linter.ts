'use strict';
import * as vscode from 'vscode';
import * as child_process from 'child_process';

export const diagnosticCollection = vscode.languages.createDiagnosticCollection('crystal');

export const openValidate = vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
    if (document.languageId === 'crystal') {
        validateFile(document);
    }
});

export const saveValidate = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    if (document.languageId === 'crystal') {
        validateFile(document);
    }
});

export function validateFile(document: vscode.TextDocument) {
    let config = vscode.workspace.getConfiguration('crystal-lang');
    if (!config['verifyFiles']) {
        return;
    }
    diagnosticCollection.clear();
    let diagnostics = [];
    let fileName = document.fileName;
    if (config['mainFile'] !== "") {
        fileName = config['mainFile'];
    }
    child_process.exec(`crystal build --no-color --no-codegen -f json ${fileName}`, (err, response) => {
        if (response && !response.startsWith("Warning:")) {
            let results = JSON.parse(response);
            let length = Math.min(config['maxNumberOfProblems'], results.length);
            for (let problemNumber = 0; problemNumber < length; problemNumber += 1) {
                let problem = results[problemNumber];
                let range = new vscode.Range(problem.line - 1, problem.column - 1, problem.line - 1, (problem.column + (problem.size || 0) - 1));
                let diagnostic = new vscode.Diagnostic(range, problem.message, vscode.DiagnosticSeverity.Error);
                diagnostics.push([vscode.Uri.file(problem.file), [diagnostic]]);
            }
        }
        // Send the computed diagnostics to VSCode.
        diagnosticCollection.set(diagnostics);
    })
}
