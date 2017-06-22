'use strict';
import { Range, TextDocument, TextEdit } from 'vscode';
import { spawn } from 'child_process';

import { crystalDiagnostic } from './crystalDiagnostic'

export class CrystalFormatting {

	/**
	 * Execute crystal tool format and get response.
	 */
	execFormat(document: TextDocument) {
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
			child.on('error', (error) => {
				console.error("crystal binary NOT FOUND " + error);
				reject();
			});
		});
	}

	/**
	 * Formatting provider checking syntax error before
	 */
	async provideDocumentFormattingEdits(document: TextDocument) {
		let response = await this.execFormat(document);
		let textEditData: TextEdit[] = [];

		if ((crystalDiagnostic.responseDiagnostics(response.toString(), document.uri).length == 0) &&
			response.toString().length > 0) {
			let lastLineId = document.lineCount - 1;
			let range = new Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length);
			textEditData = [TextEdit.replace(range, response.toString())];
		}

		return textEditData;
	}
}
