import { workspace } from "vscode";
import { setStatusBar, spawnProblemsTool, compiler_mutex, crystalOutputChannel } from "./tools";

export function registerProblems(): void {
    workspace.onDidSaveTextDocument((e) => {
        if (e.uri.scheme === "file" && e.fileName.endsWith(".cr")) {
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
