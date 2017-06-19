'use strict';
import { ExtensionContext } from 'vscode';
import { platform } from 'os';

import { languageConfiguration } from './configuration'
import { documentFormatting } from './formatting'
import { diagnosticCollection, diagnosticOnOpen, diagnosticOnSave } from './diagnostic'

export function activate(context: ExtensionContext) {
	context.subscriptions.push(languageConfiguration);

	// Crystal doesn't support Windows yet
	if (platform() === 'win32') { return; }

	context.subscriptions.push(documentFormatting);
	context.subscriptions.push(diagnosticCollection);
	context.subscriptions.push(diagnosticOnOpen);
	context.subscriptions.push(diagnosticOnSave);
}

export function deactivate() {
}