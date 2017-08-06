import * as vscode from 'vscode'
import * as fs from 'fs'
import * as client from 'vscode-languageclient'

import { crystalConfiguration, crystalCheck } from './crystalConfiguration'
import { CrystalImplementationsProvider } from './crystalImplementations'
import { crystalCompletionItemProvider } from "./crystalCompletion"
import { CrystalDocumentSymbolProvider } from './crystalSymbols'
import { CrystalFormattingProvider } from './crystalFormatting'
import { diagnosticCollection } from './crystalProblemsFinder'
import { CrystalDiagnostic } from './crystalDiagnostic'
import { CrystalHoverProvider } from './crystalHover'

const CRYSTAL_MODE: vscode.DocumentFilter = { language: 'crystal', scheme: 'file' }

const crystalDiagnostic = new CrystalDiagnostic()

function crystalOnDidEvent(document) {
	if (document.languageId == 'crystal') {
		crystalDiagnostic.crystalDoDiagnostic(document)
	}
}

export async function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.languages.setLanguageConfiguration('crystal', crystalConfiguration),
		vscode.languages.registerDocumentSymbolProvider('crystal', new CrystalDocumentSymbolProvider()),
		vscode.languages.registerCompletionItemProvider(CRYSTAL_MODE, new crystalCompletionItemProvider())
	)

	let config = vscode.workspace.getConfiguration('crystal-lang')
	let scry = config['server']

	// Experimental Server using Language Server Protocol
	if (fs.existsSync(scry)) {
		let serverOptions = { command: scry, args: [] }

		let clientOptions: client.LanguageClientOptions = {
			documentSelector: ['crystal'],
			synchronize: {
				configurationSection: 'crystal-lang',
				fileEvents: vscode.workspace.createFileSystemWatcher('**/*.cr')
			}
		}

		let disposable = new client.LanguageClient('Crystal Language', serverOptions, clientOptions).start()

		context.subscriptions.push(disposable)
	} else if (crystalCheck()) {
		// If server is disabled use client implementation instead.
		context.subscriptions.push(
			diagnosticCollection,
			vscode.languages.registerDocumentFormattingEditProvider('crystal', new CrystalFormattingProvider()),
			vscode.languages.registerDefinitionProvider(CRYSTAL_MODE, new CrystalImplementationsProvider()),
			vscode.workspace.onDidOpenTextDocument(crystalOnDidEvent),
			vscode.workspace.onDidSaveTextDocument(crystalOnDidEvent)
		)
	}

	if (crystalCheck()) {
		// Not implemented on server yet.
		context.subscriptions.push(
			vscode.languages.registerHoverProvider(CRYSTAL_MODE, new CrystalHoverProvider()),
		)
	}
}

export function deactivate() { }
