'use strict';
import * as vscode from 'vscode';
import * as child_process from 'child_process';

function validateFile(document: vscode.TextDocument) {
    let fileName = document.fileName;
    let config = vscode.workspace.getConfiguration('crystal-lang');
    let problemsLimit = config['maxNumberOfProblems'];
    if (!config['verifyFiles']) {
        return;
    }
    if (config['mainFile'] !== "") {
        fileName = config['mainFile'];
    }
    child_process.exec(`crystal build --no-color --no-codegen -f json "${fileName}"`, (err, response) => {
        analyzeDocument(response, '', problemsLimit);
    })
}

interface CrystalError {
    file: string;
    size: number;
    line: number;
    column: number;
    message: string;
}

export function analyzeDocument(response: string, fileName, problemsLimit = 20) {
    diagnosticCollection.clear();
    let diagnostics = [];
    if (response.startsWith("[{\"file\":\"")) {
        let results: CrystalError[] = JSON.parse(response);
        let length = Math.min(problemsLimit, results.length);
        for (let problemNumber = 0; problemNumber < length; problemNumber += 1) {
            let problem = results[problemNumber];
            let range = new vscode.Range(problem.line - 1, problem.column - 1, problem.line - 1, (problem.column + (problem.size || 0) - 1));
            let diagnostic = new vscode.Diagnostic(range, problem.message, vscode.DiagnosticSeverity.Error);
            diagnostics.push([vscode.Uri.file(problem.file || fileName), [diagnostic]]);
        }
    } else {
        return true;
    }
    // Send the computed diagnostics to VSCode.
    diagnosticCollection.set(diagnostics);
}

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
