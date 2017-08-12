import * as vscode from "vscode"
import { spawn } from "child_process"

import { Concurrent, isNotLib, spawnLocal } from "./crystalUtils"
import { CrystalProblemsFinder } from "./crystalProblemsFinder";

export class CrystalDiagnostic extends CrystalProblemsFinder {

	/**
	 * Execute crystal build to check problems.
	 */
	crystalDoDiagnostic(document: vscode.TextDocument) {
		const config = vscode.workspace.getConfiguration("crystal-lang")
		if (config["problems"] == "syntax") {
			return spawnLocal(document, false, this.searchProblems)
		} else if (Concurrent.counter < Concurrent.limit() && config["problems"] == "build" && isNotLib(document.fileName)) {
			return spawnLocal(document, true, this.searchProblems)
		} else if (Concurrent.counter >= Concurrent.limit()) {
			console.info("INFO: crystal is taking a moment to build")
		}
	}
}

