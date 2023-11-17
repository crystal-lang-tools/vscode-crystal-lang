import {
    DocumentSelector,
    ExtensionContext,
    commands,
    window
} from 'vscode';
import { spawnMacroExpandTool } from './tools';

let crystalOutputChannel = window.createOutputChannel("Crystal", "crystal")

export function registerMacroExpansion() {

    commands.registerCommand('crystal-lang.showMacroExpansion', async function () {
        const activeEditor = window.activeTextEditor;
        const document = activeEditor.document;
        const position = activeEditor.selection.active;

        const response = await spawnMacroExpandTool(document, position)

        if (response) {
            crystalOutputChannel.appendLine(response)
        } else {
            crystalOutputChannel.appendLine("# No macro expansion found")
        }
        crystalOutputChannel.show()
    })
}
