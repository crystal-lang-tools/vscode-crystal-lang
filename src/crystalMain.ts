import * as fs from "fs"
import * as vscode from "vscode"
import * as client from "vscode-languageclient"

import { diagnosticCollection } from "./crystalUtils"
import { CrystalHoverProvider } from "./crystalHover"
import { getDiagnostic } from "./crystalDiagnostic"
import { CrystalFormattingProvider } from "./crystalFormatting"
import { CrystalDocumentSymbolProvider } from "./crystalSymbols"
import { CrystalCompletionItemProvider } from "./crystalCompletion"
import { CrystalImplementationsProvider } from "./crystalImplementations"
import { registerCrystalTask } from "./crystalTasks"
import { registerCrystalMacroHoverProvider } from "./crystalMacro"

// Language configuration for identation and patterns. Based on vscode-ruby
const crystalConfiguration = {
	indentationRules: {
		increaseIndentPattern: /^\s*((begin|(private\s+abstract|private|abstract)\s+(class|struct)|class|struct|(private|protected)\s+def|def|fun|macro|else|elsif|ensure|for|if|module|rescue|unless|until|when|in|while|case)|([^#]*\sdo\b)|([^#]*=\s*(case|if|unless)))\b([^#\{;]|("|'|\/).*\4)*(#.*)?$/,
		decreaseIndentPattern: /^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif|when|in)\b)/
	},
	wordPattern: /(-?\d+(?:\.\d+))|(:?[A-Za-z][^-`~@#%^&()=+[{}|;:'",<>/.*\]\s\\!?]*[!?]?)/
}

// VSCode identificator for Crystal
const CRYSTAL_MODE: client.DocumentSelector = [{ language: "crystal", scheme: "file" }];

/**
 * Ensure to analyze only Crystal documents
 */
function diagnosticDocument(document) {
	if (document.languageId == "crystal" && document.uri.scheme == "file") {
		getDiagnostic(document)
	}
}

/**
 * Init function for this extension
 */
export async function activate(context: vscode.ExtensionContext) {
	// Call features not implemented on server yet.
	context.subscriptions.push(
		vscode.languages.setLanguageConfiguration("crystal", crystalConfiguration),
	)

	// Extension configuration
	const config = vscode.workspace.getConfiguration("crystal-lang")

	// Register Tasks
	registerCrystalTask(context)

	registerCrystalMacroHoverProvider(context)

	// Detect server and set configuration
	let scry = config["server"]
	if (fs.existsSync(scry)) {
		let serverOptions = { command: scry, args: [] }
		let clientOptions: client.LanguageClientOptions = {
			documentSelector: CRYSTAL_MODE,
			synchronize: {
				configurationSection: "crystal-lang",
				fileEvents: vscode.workspace.createFileSystemWatcher("**/*.cr")
			}
		}
		let disposable = new client.LanguageClient("Crystal Language", serverOptions, clientOptions).start()
		context.subscriptions.push(disposable)
	} else {
		// If server is disabled use Node.js implementation instead.
		context.subscriptions.push(
			diagnosticCollection,
			vscode.languages.registerDocumentFormattingEditProvider(CRYSTAL_MODE, new CrystalFormattingProvider()),
			vscode.workspace.onDidOpenTextDocument(diagnosticDocument),
			vscode.workspace.onDidSaveTextDocument(diagnosticDocument),
			vscode.languages.registerHoverProvider(CRYSTAL_MODE, new CrystalHoverProvider()),
			vscode.languages.registerDocumentSymbolProvider(CRYSTAL_MODE, new CrystalDocumentSymbolProvider()),
			vscode.languages.registerCompletionItemProvider(CRYSTAL_MODE, new CrystalCompletionItemProvider(), '.')
		)
		if (config["implementations"]) {
			context.subscriptions.push(
				vscode.languages.registerDefinitionProvider(CRYSTAL_MODE, new CrystalImplementationsProvider()),
			)
		}
	}
}

export function deactivate() { }
