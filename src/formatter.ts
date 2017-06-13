'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as child_process from 'child_process';

import { analyzeDocument } from './linter'

function execFormatter(document: vscode.TextDocument) {
    return new Promise(function (resolve, reject) {
        let child = child_process.spawn('crystal', ['tool', 'format', '-f', 'json', '-']);
        child.stdin.write(document.getText());
        child.stdout.on('data', (data) => {
            resolve(data);
        });
        child.stdin.end();
    });
}

async function format(document: vscode.TextDocument) {
    let fileName: vscode.Uri | string;
    // document.fileName soporta caracteres especiales
    // En cambio document.uri codifica los caracteres
    // por eso solo se utiliza uri para untitled
    if (document.uri['_formatted'].startsWith('untitled:')) {
        fileName = document.uri;
    } else {
        fileName = document.fileName;
    }
    let response = await execFormatter(document);
    let editData: vscode.TextEdit[] = [];
    if (analyzeDocument(response.toString(), fileName)) {
        let lastLineId = document.lineCount - 1;
        let range = new vscode.Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length);
        editData = [vscode.TextEdit.replace(range, response.toString())];
    }
    return editData;
}

// Formatter implemented using API
export const formatRegistration = vscode.languages.registerDocumentFormattingEditProvider('crystal', {
    provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        return format(document).then((data) => {
            return data;
        })
    },
});
