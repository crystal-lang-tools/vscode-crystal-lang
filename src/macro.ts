import {
    DocumentSelector,
    ExtensionContext,
    commands,
    window
} from 'vscode';
import { spawnMacroExpandTool, crystalOutputChannel } from './tools';

export function registerMacroExpansion() {
    commands.registerCommand('crystal-lang.showMacroExpansion', async function () {
        const activeEditor = window.activeTextEditor;
        const document = activeEditor.document;
        const position = activeEditor.selection.active;

        const response = await spawnMacroExpandTool(document, position)
            .then((resp) => {
                if (resp) {
                    return resp
                } else {
                    return undefined
                }
            })

        if (response) {
            crystalOutputChannel.appendLine("```crystal\n" + response + "\n```")
        } else {
            crystalOutputChannel.appendLine("# No macro expansion found")
        }
        crystalOutputChannel.show()
    })
}
