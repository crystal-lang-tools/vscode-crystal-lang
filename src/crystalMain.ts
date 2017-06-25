'use strict'
import * as vscode from 'vscode';
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
		crystalDiagnostic.crystalDoDiagnostic(document)
	}
}

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.languages.setLanguageConfiguration('crystal', crystalConfiguration))

	if (platform() !== 'win32') {
		let commandDiagnostic = vscode.commands.registerTextEditorCommand('run.crystal.diagnostic', (editor, args) => {
			crystalOnDidEvent(editor.document)
		})
		context.subscriptions.push(
			diagnosticCollection,
			commandDiagnostic,
			vscode.languages.registerCompletionItemProvider(CRYSTAL_MODE, new crystalCompletionItemProvider()),
			vscode.languages.registerDocumentFormattingEditProvider('crystal', new CrystalFormattingProvider()),
			vscode.languages.registerDocumentSymbolProvider('crystal', new CrystalDocumentSymbolProvider()),
			vscode.languages.registerHoverProvider(CRYSTAL_MODE, new CrystalHoverProvider()),
			vscode.languages.registerImplementationProvider(CRYSTAL_MODE, new CrystalImplementationsProvider()),
			vscode.workspace.onDidOpenTextDocument(crystalOnDidEvent),
			vscode.workspace.onDidSaveTextDocument(crystalOnDidEvent)
		)
	}
}

export function deactivate() { }