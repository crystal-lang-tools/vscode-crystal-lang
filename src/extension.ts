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
import { registerProblems } from './problems';

const selector: DocumentSelector = [
	{ language: 'crystal', scheme: 'file' },
	{ language: 'ecr', scheme: 'file' }
];

export const crystalConfiguration = <LanguageConfiguration>{
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
		/(?:-?(?:0(?:b|o|x))?\d+(?:\.\d+)?(?:_?[iuf]\d+)?)|@{0,2}(?:(?:(?<!:):)?[A-Za-z][^-`~@#%^&()=+[{}|;:'",<>\/.*\]\s\\!?]*[!?]?)/,
};

let lsp_client: LanguageClient

export async function activate(context: ExtensionContext): Promise<void> {
	const config = workspace.getConfiguration("crystal-lang");
	const lsp = config["server"]

	// Specs enabled regardless of LSP support
	if (config["spec-explorer"]) new CrystalTestingProvider();

	// Language configuration independent of LSP
	context.subscriptions.push(
		languages.setLanguageConfiguration('crystal', crystalConfiguration)
	);

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
		registerCompletion(selector, context);
		registerFormatter(selector, context);
		registerSymbols(selector, context);
		registerMacroExpansion();
		registerTasks(context);
		if (config["hover"]) registerHover(selector, context);
		if (config["definitions"]) registerDefinitions(selector, context);
		if (config["problems"]) registerProblems();

		crystalOutputChannel.appendLine('[Crystal] extension loaded');
	}
}

export function deactivate() {
	if (lsp_client) {
		return lsp_client.stop()
	}

	return;
}
