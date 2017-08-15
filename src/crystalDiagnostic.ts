import * as vscode from "vscode"
import { spawn } from "child_process"

import { Concurrent, isNotLib, spawnCompiler } from "./crystalUtils"

// Execute crystal build to check problems.
export function getDiagnostic(document: vscode.TextDocument) {
	const config = vscode.workspace.getConfiguration("crystal-lang")
	if (config["problems"] == "syntax") {
		return spawnCompiler(document, false)
	} else if (Concurrent.counter < Concurrent.limit() && config["problems"] == "build" && isNotLib(document.fileName)) {
		return spawnCompiler(document, true)
	} else if (Concurrent.counter >= Concurrent.limit()) {
		console.info("INFO: crystal is taking a moment to build")
	}
}
