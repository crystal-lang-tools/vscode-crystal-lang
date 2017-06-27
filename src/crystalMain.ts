'use strict'
import * as vscode from 'vscode'
import { platform } from 'os'

import { CrystalImplementationsProvider } from './crystalImplementations'
import { crystalCompletionItemProvider } from "./crystalCompletion"
import { CrystalDocumentSymbolProvider } from './crystalSymbols'
import { CrystalFormattingProvider } from './crystalFormatting'
import { diagnosticCollection } from './crystalProblemsFinder'
import { crystalConfiguration } from './crystalConfiguration'
import { CrystalDiagnostic } from './crystalDiagnostic'
import { CrystalHoverProvider } from './crystalHover'

const CRYSTAL_MODE: vscode.DocumentFilter = { language: 'crystal', scheme: 'file' }

const crystalDiagnostic = new CrystalDiagnostic()

function crystalOnDidEvent(document) {
	if (document.languageId == 'crystal') {
		if (platform() !== 'win32') {
			crystalDiagnostic.crystalDoDiagnostic(document)
		} else {
			console.info('INFO: some crystal features are not supported in windows yet')
		}
	}
}

export function activate(context: vscode.ExtensionContext) {

	let commandDiagnostic = vscode.commands.registerTextEditorCommand('crystal.run.diagnostic', (editor, args) => {
		crystalOnDidEvent(editor.document)
	})

	context.subscriptions.push(
		vscode.languages.setLanguageConfiguration('crystal', crystalConfiguration),
		vscode.languages.registerDocumentSymbolProvider('crystal', new CrystalDocumentSymbolProvider()),
		commandDiagnostic
	)

	if (platform() !== 'win32') {
		context.subscriptions.push(
			diagnosticCollection,
			vscode.languages.registerCompletionItemProvider(CRYSTAL_MODE, new crystalCompletionItemProvider()),
			vscode.languages.registerDocumentFormattingEditProvider('crystal', new CrystalFormattingProvider()),
			vscode.languages.registerHoverProvider(CRYSTAL_MODE, new CrystalHoverProvider()),
			vscode.languages.registerImplementationProvider(CRYSTAL_MODE, new CrystalImplementationsProvider()),
			vscode.workspace.onDidOpenTextDocument(crystalOnDidEvent),
			vscode.workspace.onDidSaveTextDocument(crystalOnDidEvent)
		)
	}
}

export function deactivate() { }