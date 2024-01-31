import { TextDocument, workspace } from "vscode";
import { setStatusBar, compiler_mutex, crystalOutputChannel, diagnosticCollection, execAsync, findProblems, getCompilerPath, getShardMainPath, getWorkspaceFolder, shellEscape } from "./tools";

export function registerProblems(): void {
    workspace.onDidSaveTextDocument((e) => {
        if (e.uri.scheme === "file" && (e.fileName.endsWith(".cr") || e.fileName.endsWith(".ecr"))) {
            if (compiler_mutex.isLocked()) return;

            const dispose = setStatusBar('finding problems...');

            compiler_mutex.acquire()
                .then((release) => {
                    spawnProblemsTool(e)
                        .catch((err) => {
                            crystalOutputChannel.appendLine(`[Problems] Error: ${JSON.stringify(err)}`)
                        })
                        .finally(() => {
                            release()
                        })
                })
                .finally(() => {
                    dispose()
                })
        }
    })

    return;
}

async function spawnProblemsTool(document: TextDocument): Promise<void> {
    const compiler = await getCompilerPath();
    const main = await getShardMainPath(document);
    const folder = getWorkspaceFolder(document.uri).uri.fsPath;
    const config = workspace.getConfiguration('crystal-lang');

    // If document is in a folder of the same name as the document, it will throw an
    // error about not being able to use an output filename of '...' as it's a folder.
    // This is probably a bug as the --no-codegen flag is set, there is no output.
    //
    //    Error: can't use `...` as output filename because it's a directory
    //
    const output = process.platform === "win32" ? "nul" : "/dev/null"

    const cmd = `${shellEscape(compiler)} build ${shellEscape(main)} --no-debug --no-color --no-codegen --error-trace -f json -o ${output} ${config.get<string>("flags")}`

    crystalOutputChannel.appendLine(`[Problems] (${getWorkspaceFolder(document.uri).name}) $ ` + cmd)
    await execAsync(cmd, folder)
        .then((response) => {
            diagnosticCollection.clear()
            crystalOutputChannel.appendLine("[Problems] No problems found.")
        }).catch((err) => {
            findProblems(err.stderr, document.uri)
            try {
                const parsed = JSON.parse(err.stderr)
                crystalOutputChannel.appendLine(`[Problems] Error: ${err.stderr}`)
            } catch {
                crystalOutputChannel.appendLine(`[Problems] Error: ${JSON.stringify(err)}`)
            }
        });
}
