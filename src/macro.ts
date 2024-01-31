import { Position, TextDocument, commands, window, workspace } from 'vscode';
import { crystalOutputChannel, execAsync, findProblems, getCompilerPath, getCursorPath, getShardMainPath, getWorkspaceFolder, shellEscape } from './tools';

export const macroOutputChannel = window.createOutputChannel("Crystal Macro", "markdown")

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
            macroOutputChannel.appendLine("```crystal\n" + response + "```\n")
        } else {
            macroOutputChannel.appendLine("# No macro expansion found")
        }
        macroOutputChannel.show()
    })
}

export async function spawnMacroExpandTool(document: TextDocument, position: Position): Promise<string | void> {
    const compiler = await getCompilerPath();
    const main = await getShardMainPath(document);
    const cursor = getCursorPath(document, position);
    const folder = getWorkspaceFolder(document.uri);
    const config = workspace.getConfiguration('crystal-lang');

    const cmd = `${shellEscape(compiler)} tool expand ${shellEscape(main)} --cursor ${shellEscape(cursor)} ${config.get<string>("flags")}`

    crystalOutputChannel.appendLine(`[Macro Expansion] (${folder.name}) $ ` + cmd)
    return await execAsync(cmd, folder.uri.fsPath)
        .then((response) => {
            return response;
        })
        .catch(async (err) => {
            const new_cmd = cmd + ' -f json'
            await execAsync(new_cmd, folder.uri.fsPath)
                .catch((err) => {
                    findProblems(err.stderr, document.uri)
                    crystalOutputChannel.appendLine(`[Macro Expansion] Error: ${err.message}`)
                })
        });
}
