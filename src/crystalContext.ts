import * as vscode from "vscode"
import { spawn } from "child_process"

import { spawnTools } from "./crystalUtils"

// Call tool for get Crystal context
export class CrystalContext {

	// Execute crystal tool context for current file:position
	crystalContext(document, position, key) {
		return spawnTools(document, position, "context", key)
	}
}