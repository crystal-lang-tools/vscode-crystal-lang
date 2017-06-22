'use strict';
import { ExtensionContext, DocumentFilter, languages } from 'vscode';
import { platform } from 'os';

import { crystalConfiguration } from './crystalConfiguration'
import { CrystalFormatting } from './crystalFormatting';
import { diagnosticCollection, diagnosticOnOpen, diagnosticOnSave } from './crystalDiagnostic';

export const CRYSTAL_MODE: DocumentFilter = { language: 'crystal' };

export function activate(context: ExtensionContext) {

	context.subscriptions.push(languages.setLanguageConfiguration('crystal', crystalConfiguration));

	if (platform() !== 'win32') {
		context.subscriptions.push(languages.registerDocumentFormattingEditProvider(CRYSTAL_MODE, new CrystalFormatting()));
		context.subscriptions.push(diagnosticCollection);
		context.subscriptions.push(diagnosticOnOpen);
		context.subscriptions.push(diagnosticOnSave);
	}

}

export function deactivate() { }