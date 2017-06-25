'use strict'
import * as vscode from "vscode"

// Add crystal process limit
export class CrystalLimit {
	static processes = 0
	static limit() {
		let config = vscode.workspace.getConfiguration('crystal-lang')
		return config['processesLimit']
	}
}

// Add current workspace to crystal path
const CRENV = Object.create(process.env)
CRENV.CRYSTAL_PATH = `${vscode.workspace.rootPath}/lib:/usr/lib/crystal`
export const ENV = CRENV

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