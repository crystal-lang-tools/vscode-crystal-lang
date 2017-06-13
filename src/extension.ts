'use strict';
import * as vscode from 'vscode';

import { formatRegistration } from './formatter'
import { diagnosticCollection, openValidate, saveValidate } from './linter'

export function activate(context: vscode.ExtensionContext) {

    // Add indentation rules for crystal language
    const indentationRules = vscode.languages.setLanguageConfiguration('crystal', {
        indentationRules: {
            increaseIndentPattern: /^.*(do|fun|def|macro|struct|class|lib|module|begin|rescue|if|elif|else).*$/,
            decreaseIndentPattern: /^.*(rescue|elif|else|end).*$/
        }
    });

    context.subscriptions.push(indentationRules);
    context.subscriptions.push(formatRegistration);
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(openValidate);
    context.subscriptions.push(saveValidate);
}

export function deactivate() {
}