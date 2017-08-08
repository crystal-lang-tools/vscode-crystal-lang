import * as vscode from "vscode"
import { execSync } from 'child_process'

// Crystal keywords used by context tool
export const KEYWORDS = [
	'begin', 'class', 'def', 'do', 'else',
	'elsif', 'end', 'ensure', 'fun', 'if',
	'lib', 'macro', 'module', 'rescue', 'struct',
	'loop', 'case', 'select', 'then', 'when',
	'while', 'for', 'return', 'macro', 'require',
	'private', 'protected', 'yield'
]

const CRENV = Object.create(process.env)
export const ROOT = vscode.workspace.rootPath

// Add current workspace to crystal path
CRENV.CRYSTAL_PATH = `${ROOT}/lib:/usr/lib/crystal`
export const ENV = CRENV

export const Config = vscode.workspace.getConfiguration('crystal-lang')

// Get main file in a project
export function mainFile(document) {
	if (Config['mainFile']) {
		return Config['mainFile'].replace('${workspaceRoot}', ROOT)
	} else {
		return document
	}
}

// Add crystal process limit
export class Concurrent {
	static counter = 0
	static limit() {
		return Config['processesLimit']
	}
}

// Check if crystal command exists
export function crystalCheck() {
	try {
		execSync(`${Config['compiler']}`)
		return true
	} catch (ex) {
		vscode.window.showErrorMessage('Crystal compiler not found. ' + ex.message)
		console.error(ex)
		return false
	}
}

// Ensure that file is not inside lib folders
export function isNotLib(file) {
	if (file.startsWith('/usr/lib') || file.startsWith(`${ROOT}/lib`)) {
		return false
	} else {
		return true
	}
}

export const crystalConfiguration = {
	// Add indentation rules for crystal language
	indentationRules: {
		// /^[^#]*(
		//       ((
		//         ((if|elsif|lib|fun|module|struct|class|def|macro|do|rescue)\s)|
		//         (end\.)
		//       ).*)|
		//       ((begin|else|ensure|do|rescue)\b)
		//     )
		// $/
		increaseIndentPattern: /^[^#]*(((((if|elsif|lib|fun|module|struct|class|def|macro|do|rescue)\s)|(end\.)).*)|((begin|else|ensure|do|rescue)\b))$/,
		// /^\s*(
		//        ((rescue|ensure|else)\b)|
		//        (elsif\s.*)|
		//        (end(\..*|\b))
		//      )
		// $/
		decreaseIndentPattern: /^\s*(((rescue|ensure|else)\b)|(elsif\s.*)|(end(\..*|\b)))$/
	}
}