'use strict';
import { languages, Range, TextDocument, TextEdit } from 'vscode';
import { spawn } from 'child_process';

import { responseDiagnostics } from './diagnostic'

/**
 * Execute crystal tool format and get response.
 * @param document TextDocument
 */
function execFormat(document: TextDocument) {
	return new Promise(function (resolve, reject) {
		let dataStorage = "";
		let child = spawn('crystal', ['tool', 'format', '-f', 'json', '-']);
		child.stdin.write(document.getText());
		child.stdin.end();
		child.stdout.on('data', (data) => {
			dataStorage += data;
		});
		child.stdout.on('end', (data) => {
			resolve(dataStorage);
		});
	});
}

export const documentFormatting = languages.registerDocumentFormattingEditProvider('crystal', {
	async provideDocumentFormattingEdits(document: TextDocument): Promise<TextEdit[]> {
		let response = await execFormat(document);
		let textEditData: TextEdit[] = [];

		if (responseDiagnostics(response.toString(), document.uri).length == 0) {
			let lastLineId = document.lineCount - 1;
			let range = new Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length);
			textEditData = [TextEdit.replace(range, response.toString())];
		}

		return textEditData;
	}
});
