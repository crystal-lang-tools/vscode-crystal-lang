import {
	DocumentSelector,
	ExtensionContext,
	LanguageConfiguration,
	languages,
} from 'vscode';
import { registerCompletion } from './completion';
import { registerFormatter } from './format';
import { registerHover } from './hover';
import { registerImplementations } from './implementations';
import { registerSymbols } from './symbols';

const selector = <DocumentSelector>[{ language: 'crystal', scheme: 'file' }];

const configuration = <LanguageConfiguration>{
	indentationRules: {
		increaseIndentPattern:
			/^\s*((begin|(private\s+abstract|private|abstract)\s+(module|class|struct|enum)|class|struct|(private|protected)\s+def|def|fun|macro|else|elsif|ensure|for|if|module|enum|rescue|unless|until|when|while|case)|([^#]*\sdo\b)|([^#]*=\s*(case|if|unless)))\b([^#\{;]|("|'|\/).*\4)*(#.*)?$/,
		decreaseIndentPattern:
			/^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif|when|(?:case[\s\S\n]+)in)\b)/,
	},
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
	registerImplementations(selector, context);
	registerSymbols(selector, context);
}

export function deactivate() {}
