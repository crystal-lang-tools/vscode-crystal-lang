import { Position, TextDocument, ViewColumn, commands, window, workspace } from 'vscode';
import { crystalOutputChannel, execAsync, findProblems, getCompilerPath, getCursorPath, getShardMainPath, getWorkspaceFolder, shellEscape } from './tools';

export const macroOutputChannel = window.createOutputChannel("Crystal Macro", "markdown")
let macroExpansionPanel = undefined;

export function registerMacroExpansion() {
  commands.registerCommand('crystal-lang.showMacroExpansion', async function () {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) return;

    const document = activeEditor.document;
    const position = activeEditor.selection.active;

    const response = await spawnMacroExpandTool(document, position)
      .then((resp) => resp || undefined);

    if (response) {
      showMacroExpansion(response);
    } else {
      showMacroExpansion("# No macro expansion found");
    }
  })
}

function showMacroExpansion(content) {
  if (!macroExpansionPanel) {
    macroExpansionPanel = window.createWebviewPanel(
      'macroExpansion', // Identifies the type of the webview. Used internally
      'Macro Expansion', // Title of the panel displayed to the user
      ViewColumn.One, // Editor column to show the new webview panel in.
      {
        // Enable scripts in the webview
        enableScripts: true
      }
    );

    macroExpansionPanel.onDidDispose(() => {
      // When the panel is closed, unset the panel variable so we can create a new one next time
      macroExpansionPanel = undefined;
    });
  }

  // Update the content of the webview panel
  macroExpansionPanel.webview.html = getWebviewContent(content);
}

function getWebviewContent(content) {
  // Escape HTML special characters
  const escapedContent = escapeHtml(content);
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Macro Expansion</title>
    </head>
    <body>
        <pre><code class="language-crystal">${escapedContent}</code></pre>
    </body>
    </html>
  `;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function spawnMacroExpandTool(document: TextDocument, position: Position): Promise<string | void> {
  const compiler = await getCompilerPath();
  const main = await getShardMainPath(document);
  if (!main) return;

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
