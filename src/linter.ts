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
    if (document.uri['_formatted'].startsWith('untitled:')) {
        let child = child_process.spawn('crystal', ['tool', 'format', '--check','-f', 'json', '-']);
        child.stdin.write(document.getText());
        child.stdout.on('data', (data) => {
            analyzeDocument(data.toString(), document.uri, problemsLimit);
        });
        child.stdin.end();
    } else {
        child_process.exec(`crystal build --no-color --no-codegen -f json "${fileName}"`, (err, response) => {
            analyzeDocument(response, document.uri, problemsLimit);
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

export function analyzeDocument(response: string, uriFormat, problemsLimit = 20) {
    diagnosticCollection.clear();
    let diagnostics = [];
    if (response.startsWith("[{\"file\":\"")) {
        let results: CrystalError[] = JSON.parse(response);
        let length = Math.min(problemsLimit, results.length);
        for (let problemNumber = 0; problemNumber < length; problemNumber += 1) {
            let problem = results[problemNumber];
            let range = new vscode.Range(problem.line - 1, problem.column - 1, problem.line - 1, (problem.column + (problem.size || 0) - 1));
            let diagnostic = new vscode.Diagnostic(range, problem.message, vscode.DiagnosticSeverity.Error);
            let file: vscode.Uri;
            // uriFormat puede ser string o URI
            if (uriFormat.hasOwnProperty('_formatted')) {
                if (uriFormat._formatted.startsWith('untitled:')) {
                    // Formater in untitled
                    // Live linting (se necesita servidor,
                    // porque child_process en cada cambio es muy pesado)
                    // Por ahora no se puede live linter en untitled
                    file = vscode.Uri.parse(uriFormat);
                } else {
                    // Linter para archivo existente en disco
                    // Se puede live linter with autosaving
                    // Pueden haber diferentes archivos por lo cual se usa problem.file
                    // y no document.fileName
                    file = vscode.Uri.file(problem.file);
                }
            } else {
                // Formater para archivo existente en disco,
                // se necesita recalcular la uri as string porque crystal
                // no da información sobre file en tool format
                file = vscode.Uri.file(uriFormat);
            }
            diagnostics.push([file, [diagnostic]]);
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
