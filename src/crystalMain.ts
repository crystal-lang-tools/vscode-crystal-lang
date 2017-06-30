'use strict'
import * as vscode from 'vscode'
import { platform, arch } from 'os'
import * as fs from 'fs'
import * as client from 'vscode-languageclient'
import * as SevenZip from 'node-7z'

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
			console.info('INFO: some crystal features are not supported on Windows yet')
		}
	}
}

/**
 * Extract Scry binary from 7z file.
 */
function extractScry(path) {
	return new Promise((resolve, reject) => {
		let unzip = new SevenZip()

		unzip.extractFull(path + '.7z', path.slice(0, -4)).progress((files) => {
			console.log('Extracting Scry files...')
		}).then(() => {
			console.log('Scry Extracting done!')
			resolve()
		}).catch((err) => {
			console.error(err)
			reject()
		});
	})
}

export async function activate(context: vscode.ExtensionContext) {

	let commandDiagnostic = vscode.commands.registerTextEditorCommand('crystal.run.diagnostic', (editor, args) => {
		crystalOnDidEvent(editor.document)
	})

	context.subscriptions.push(
		vscode.languages.setLanguageConfiguration('crystal', crystalConfiguration),
		vscode.languages.registerDocumentSymbolProvider('crystal', new CrystalDocumentSymbolProvider()),
		vscode.languages.registerCompletionItemProvider(CRYSTAL_MODE, new crystalCompletionItemProvider()),
		commandDiagnostic
	)

	if (platform() !== 'win32') {
		let config = vscode.workspace.getConfiguration('crystal-lang')

		// Experimental Server using Language Server Protocol
		if (config['server']) {
			if (arch() == 'x64') {
				let command: string = ''
				let serverOptions: client.ServerOptions

				// if (platform() == 'win32') {
				// 	command = context.asAbsolutePath('bin/win32/scry.exe')
				// 	console.info("INFO: crystal doesn't support Windows yet")
				// }
				if (platform() == 'darwin') {
					// command = context.asAbsolutePath('bin/darwin/scry')
					console.info("INFO: This crystal binary isn't avaliable yet")
				} else if (platform() == 'linux') {
					command = context.asAbsolutePath('bin/linux/scry')
				}
				if (!fs.existsSync(command)) {
					await extractScry(command)
				}

				if (fs.existsSync(command)) {
					serverOptions = { command: command, args: [] }

					let clientOptions: client.LanguageClientOptions = {
						documentSelector: ['crystal'],
						synchronize: {
							configurationSection: 'crystal-lang',
							fileEvents: vscode.workspace.createFileSystemWatcher('**/*.cr')
						}
					}

					let disposable = new client.LanguageClient('Crystal Language', serverOptions, clientOptions).start()

					context.subscriptions.push(disposable)
				} else {
					console.info("INFO: Scry binary not avaliable")
				}
			} else {
				console.info("INFO: 32 bits architectures are deprecated")
			}
		} else {
			// If server is disabled use client implementation instead.
			context.subscriptions.push(
				diagnosticCollection,
				vscode.languages.registerDocumentFormattingEditProvider('crystal', new CrystalFormattingProvider()),
				vscode.languages.registerImplementationProvider(CRYSTAL_MODE, new CrystalImplementationsProvider()),
				vscode.workspace.onDidOpenTextDocument(crystalOnDidEvent),
				vscode.workspace.onDidSaveTextDocument(crystalOnDidEvent)
			)
		}

		// Not implemented on server yet.
		context.subscriptions.push(
			vscode.languages.registerHoverProvider(CRYSTAL_MODE, new CrystalHoverProvider()),
		)
	}
}

export function deactivate() { }