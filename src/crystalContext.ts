import * as vscode from "vscode"
import { spawn } from "child_process"

import { spawnPromise } from "./crystalUtils"
import { CrystalProblemsFinder } from "./crystalProblemsFinder"

export class CrystalContext extends CrystalProblemsFinder {
	/**
	 * Execute crystal tool context for current file:position
	 * and do syntax checking too.
	 */
	crystalContext(document, position, key) {
		return spawnPromise(document, position, "context", key, this.searchProblems)
	}
}