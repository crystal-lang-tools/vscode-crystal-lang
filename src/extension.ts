'use strict';
import { ExtensionContext } from 'vscode';
import { platform } from 'os';

import { languageConfiguration } from './configuration'
// import { documentFormatting } from './formatting'
// import { diagnosticCollection, diagnosticOnOpen, diagnosticOnSave } from './diagnostic'

export function activate(context: ExtensionContext) {
	context.subscriptions.push(languageConfiguration);

	// Crystal doesn't support Windows yet
	if (platform() !== 'win32') {
		const formatting = require('./formatting');
		const diagnostic = require('./diagnostic');
		context.subscriptions.push(formatting.documentFormatting);
		context.subscriptions.push(diagnostic.diagnosticCollection);
		context.subscriptions.push(diagnostic.diagnosticOnOpen);
		context.subscriptions.push(diagnostic.diagnosticOnSave);
	}

}

export function deactivate() {
}