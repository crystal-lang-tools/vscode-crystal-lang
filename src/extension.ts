import * as vscode from 'vscode';
import {
    DocumentSelector,
    ExtensionContext,
    LanguageConfiguration
} from 'vscode';
import * as client from 'vscode-languageclient';
import { registerFormatter } from './format';

const selector = <DocumentSelector> [{ language: 'crystal', scheme: 'file' }];

const configuration = <LanguageConfiguration> {
	indentationRules: {
		increaseIndentPattern: /^\s*((begin|(private\s+abstract|private|abstract)\s+(class|struct)|class|struct|(private|protected)\s+def|def|fun|macro|else|elsif|ensure|for|if|module|rescue|unless|until|when|in|while|case)|([^#]*\sdo\b)|([^#]*=\s*(case|if|unless)))\b([^#\{;]|("|'|\/).*\4)*(#.*)?$/,
		decreaseIndentPattern: /^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif|when|in)\b)/
	},
	wordPattern: /(-?\d+(?:\.\d+))|(:?[A-Za-z][^-`~@#%^&()=+[{}|;:'",<>/.*\]\s\\!?]*[!?]?)/
}

export async function activate(context: ExtensionContext): Promise<void> {
    context.subscriptions.push(
        vscode.languages.setLanguageConfiguration('crystal', configuration)
    );

    registerFormatter(selector, context);
}

export function deactivate() {}