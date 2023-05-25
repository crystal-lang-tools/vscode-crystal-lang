import * as vscode from "vscode";
import { spawnSync } from 'node:child_process';

export async function registerCrystalMacroHoverProvider(context: vscode.ExtensionContext) {
    let macroExpansionChannel = vscode.window.createOutputChannel("Crystal Macro Expansion", "crystal")

    vscode.languages.registerHoverProvider({ scheme: 'file', language: 'crystal' }, {
        provideHover(document, position, token) {
            return expandMacroToHover(document, position);
        }
    })

    vscode.commands.registerCommand('crystal-lang.showMacroExpansion', function() {
        const activeEditor = vscode.window.activeTextEditor;
        const document = activeEditor.document;
        const position = activeEditor.selection.active;
        const positionString = `${document.uri.path}:${position.line + 1}:${position.character + 1}`;

        let stdout = execExpandMacro(document, position)

        if (stdout === undefined || stdout === "") {
            return;
        }

        if (stdout.startsWith("no expansion found")) {
            stdout = `# No macro expansion for ${positionString}`;
        } else {
            stdout = `# Macro expansion for ${positionString}:\n\n${stdout}\n`
        }

        macroExpansionChannel.appendLine(stdout)
        macroExpansionChannel.show()
    })
}

function execExpandMacro(document: vscode.TextDocument, position: vscode.Position): string {
    const config = vscode.workspace.getConfiguration("crystal-lang")

    let currentWorkspacePath = vscode.workspace.getWorkspaceFolder(document.uri).uri.path

    let documentPath = document.uri.path;
    let line = position.line + 1;
    let column = position.character + 1;

    let expandArgs: string[] = ['tool', 'expand']

    let mainFile = '';
    if (config["mainFile"]) {
        mainFile = config["mainFile"].replace("${workspaceRoot}", currentWorkspacePath)

        if (mainFile !== documentPath) {
            expandArgs.push(mainFile)
        }
    }

    expandArgs.push(documentPath, '--cursor', `${documentPath}:${line}:${column}`)

    let result = spawnSync(
        config["compiler"], expandArgs,
        { cwd: currentWorkspacePath }
    );

    if (result.status !== 0) {
        console.error(result.stderr.toString());
        return;
    }

    let stdout = result.output.join('\n').replace(/^\n+|\n+$/g, '');

    return stdout
}

function expandMacroToHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover {
    const config = vscode.workspace.getConfiguration("crystal-lang")
    if (!config["macroExpansionHover"]) {
        return;
    }

    let stdout = execExpandMacro(document, position)

    if (stdout.startsWith("no expansion found")) {
        return;
    }

    let markdownResult = new vscode.MarkdownString("```\n" + stdout + "\n```");

    let lineText = document.lineAt(position).text;
    let lineStart = document.offsetAt(new vscode.Position(position.line, 0));
    let lineEnd = lineStart + lineText.length;
    let range = new vscode.Range(document.positionAt(lineStart), document.positionAt(lineEnd));

    return new vscode.Hover(markdownResult, range)
}
