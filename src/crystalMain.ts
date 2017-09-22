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

// Language configuration for identation and patterns.
const crystalConfiguration = {
	indentationRules: {
		increaseIndentPattern: /^\s*((begin|class|struct|private def|protected def|def|fun|macro|else|elsif|ensure|for|if|module|rescue|unless|until|when|while)|([^#]*\sdo\b))\b[^\{;]*$/,
		decreaseIndentPattern: /^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif)\b)/
	},
	wordPattern: /(-?\d+(?:\.\d+))|(:?[A-Za-z][^-`~@#%^&()=+[{}|;:'",<>/.*\]\s\\!?]*[!?]?)/
}

// VSCode identificator for Crystal
const CRYSTAL_MODE: vscode.DocumentFilter = { language: "crystal", scheme: "file" }

// Ensure to analyze only Crystal documents
function diagnosticDocument(document) {
	if (document.languageId == "crystal") {
		getDiagnostic(document)
	}
}

// Init function for this extension
export async function activate(context: vscode.ExtensionContext) {

	// Call features not implemented on server yet.
	context.subscriptions.push(
		vscode.languages.setLanguageConfiguration("crystal", crystalConfiguration),
		vscode.languages.registerHoverProvider(CRYSTAL_MODE, new CrystalHoverProvider()),
		vscode.languages.registerDocumentSymbolProvider("crystal", new CrystalDocumentSymbolProvider()),
		vscode.languages.registerCompletionItemProvider(CRYSTAL_MODE, new CrystalCompletionItemProvider())
	)

	// Extension configuration
	const config = vscode.workspace.getConfiguration("crystal-lang")

	// Detect server and set configuration
	let scry = config["server"]
	if (fs.existsSync(scry)) {
		let serverOptions = { command: scry, args: [] }
		let clientOptions: client.LanguageClientOptions = {
			documentSelector: ["crystal"],
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
			vscode.languages.registerDocumentFormattingEditProvider("crystal", new CrystalFormattingProvider()),
			vscode.workspace.onDidOpenTextDocument(diagnosticDocument),
			vscode.workspace.onDidSaveTextDocument(diagnosticDocument)
		)
		if (config["implementations"]) {
			context.subscriptions.push(
				vscode.languages.registerDefinitionProvider(CRYSTAL_MODE, new CrystalImplementationsProvider()),
			)
		}
	}
}

export function deactivate() { }
