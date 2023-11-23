import {
	ExtensionContext,
	IndentAction,
	LanguageConfiguration,
	languages,
	workspace,
} from 'vscode';
import { registerCompletion } from './completion';
import { registerFormatter } from './format';
import { registerHover } from './hover';
import { registerDefinitions } from './definitions';
import { registerSymbols } from './symbols';
import { CrystalTestingProvider } from './spec';
import { registerMacroExpansion } from './macro';
import { crystalOutputChannel } from './tools';
import { registerTasks } from './tasks';
import { existsSync } from 'fs';
import { LanguageClient, LanguageClientOptions, DocumentSelector, MessageTransports, ServerOptions } from "vscode-languageclient/node"

const selector: DocumentSelector = [{ language: 'crystal', scheme: 'file' }];

const configuration = <LanguageConfiguration>{
	comments: { lineComment: '#' },
	indentationRules: {
		increaseIndentPattern:
			/^\s*((begin|(private\s+abstract|private|abstract)\s+(module|class|struct|enum)|class|struct|(private|protected)\s+def|def|fun|macro|else|elsif|ensure|for|if|module|enum|rescue|unless|until|when|while|case)|([^#]*\sdo\b)|([^#]*=\s*(case|if|unless)))\b([^#\{;]|("|'|\/).*\4)*(#.*)?$/,
		decreaseIndentPattern:
			/^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif|when|(?:case[\s\S\n]+)in)\b)/,
	},
	onEnterRules: [
		{
			beforeText: /^\s*#(?!{).*$/,
			action: {
				appendText: '# ',
				indentAction: IndentAction.None,
			},
		},
	],
	wordPattern:
		/(-?\d+(?:\.\d+))|(:?[A-Za-z][^-`~@#%^&()=+[{}|;:'",<>/.*\]\s\\!?]*[!?]?)/,
};

let lsp_client: LanguageClient

export async function activate(context: ExtensionContext): Promise<void> {
	const config = workspace.getConfiguration("crystal-lang");
	const lsp = config["server"]

	if (config["spec-explorer"]) {
		new CrystalTestingProvider()
	}

	if (existsSync(lsp)) {
		crystalOutputChannel.appendLine(`[Crystal] loading lsp ${lsp}`)

		let serverOptions: ServerOptions = { command: lsp, args: [] }
		let clientOptions: LanguageClientOptions = {
			documentSelector: selector,
			synchronize: {
				configurationSection: "crystal-lang",
				fileEvents: workspace.createFileSystemWatcher("**/*.cr")
			},
			outputChannel: crystalOutputChannel
		}
		let lsp_client = new LanguageClient("Crystal Language", serverOptions, clientOptions)
		lsp_client.start()

		return;
	} else {
		context.subscriptions.push(
			languages.setLanguageConfiguration('crystal', configuration)
		);

		registerCompletion(selector, context);
		registerFormatter(selector, context);
		registerHover(selector, context);
		registerDefinitions(selector, context);
		registerSymbols(selector, context);
		registerMacroExpansion();
		registerTasks(context);

		crystalOutputChannel.appendLine('[Crystal] extension loaded');
	}
}

export function deactivate() {
	if (lsp_client) {
		return lsp_client.stop()
	}

	return;
}
