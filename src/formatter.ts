'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as child_process from 'child_process';

import { validateFile } from './linter'

function execFormatter(document: vscode.TextDocument) {
    return new Promise(function (resolve, reject) {
        child_process.exec(`crystal tool format ${document.fileName}~`, (err, response) => {
            validateFile(document);
            resolve(response);
        });
    });
}

function readResult(document: vscode.TextDocument) {
    let fileName = document.fileName;
    let editData = [];
    return new Promise(function (resolve, reject) {
        fs.readFile(`${fileName}~`, (err, data) => {
            // Delete temp file
            fs.unlinkSync(`${fileName}~`);
            if (data) {
                let lastLineId = document.lineCount - 1;
                let range = new vscode.Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length);
                editData = [vscode.TextEdit.replace(range, data.toString())];
            }
            resolve(editData);
        })
    });
}

async function format(document: vscode.TextDocument) {
    let fileName = document.fileName;

    // Create temp file
    fs.createReadStream(fileName).pipe(fs.createWriteStream(`${fileName}~`));

    let err = await execFormatter(document);

    if (err) {
        console.error(err)
        return;
    } else {
        return await readResult(document);
    }
}

// Formatter implemented using API
export const formatRegistration = vscode.languages.registerDocumentFormattingEditProvider('crystal', {
    provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        if (document.isDirty) {
            document.save();
        }
        document.uri
        return format(document).then((data) => {
            return data;
        })
    },
});
