import {
	DocumentSelector,
	ExtensionContext,
	IndentAction,
	LanguageConfiguration,
	languages,
} from 'vscode';
import { registerCompletion } from './completion';
import { registerFormatter } from './format';
import { registerHover } from './hover';
import { registerDefinitions } from './definitions';
import { registerSymbols } from './symbols';
import { CrystalTestingProvider } from './spec';
import { registerMacroExpansion } from './macro';

const selector = <DocumentSelector>[{ language: 'crystal', scheme: 'file' }];

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

export async function activate(context: ExtensionContext): Promise<void> {
	context.subscriptions.push(
		languages.setLanguageConfiguration('crystal', configuration)
	);

	registerCompletion(selector, context);
	registerFormatter(selector, context);
	registerHover(selector, context);
	registerDefinitions(selector, context);
	registerSymbols(selector, context);
	registerMacroExpansion();

	// Register tests/specs
	new CrystalTestingProvider()

	console.debug('[Crystal] extension loaded');
}

export function deactivate() { }
