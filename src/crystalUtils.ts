import * as vscode from "vscode"
import { execSync, spawn } from "child_process"

// ---------------
// Local utilities
// ---------------

const config = vscode.workspace.getConfiguration("crystal-lang")
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
const CRENV = Object.create(process.env)

// Adjust CRYSTAL_PATH using current workspace
const ROOT = vscode.workspace.rootPath

// Check if crystal command exists
// Based on https://github.com/atom-crystal/ide-crystal/blob/master/lib/util/compiler.js
const STDLIB = (() => {
	const regex = /CRYSTAL_PATH="(.*)"\n/;
	try {
		let output = execSync(`${config["compiler"]} env`)
		const match = regex.exec(output.toString());
		if (match && match.length === 2) {
			return match[1]
		} else {
			return "lib"
		}
	} catch (ex) {
		vscode.window.showWarningMessage("Crystal compiler not found. Some features can throw errors.")
		console.error(ex)
	}
})()

CRENV.CRYSTAL_PATH = `${ROOT}/lib:${STDLIB}`
const ENV = CRENV

// --------------------------
// Global constants utilities
// --------------------------

const KEYWORDS = [
	"begin", "class", "def", "do", "else",
	"elsif", "end", "ensure", "fun", "if",
	"lib", "macro", "module", "rescue", "struct",
	"loop", "case", "select", "then", "when",
	"while", "for", "return", "macro", "require",
	"private", "protected", "yield"
]

export function isNotKeyword(word) {
	return KEYWORDS.indexOf(word) < 0
}

// Get main file in a project
export function mainFile(document) {
	const config = vscode.workspace.getConfiguration("crystal-lang")
	if (config["mainFile"]) {
		return config["mainFile"].replace("${workspaceRoot}", ROOT)
	} else {
		return document
	}
}

// Add crystal process limit
export class Concurrent {
	static counter = 0
	static limit() {
		return config["processesLimit"]
	}
}

// Ensure that file is not inside lib folders
export function isNotLib(file) {
	let stdlib = STDLIB.split(":")
	if (file.startsWith(stdlib[0]) || file.startsWith(stdlib[1]) || file.startsWith(`${ROOT}/lib`)) {
		return false
	} else {
		return true
	}
}

// Register language config
// Based on https://github.com/rubyide/vscode-ruby/blob/master/src/ruby.ts
export const crystalConfiguration = {
	indentationRules: {
		increaseIndentPattern: /^\s*((begin|class|struct|def|fun|macro|else|elsif|ensure|for|if|module|rescue|unless|until|when|while)|(.*\sdo\b))\b[^\{;]*$/,
		decreaseIndentPattern: /^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif|when)\b)/
	},
	wordPattern: /(-?\d+(?:\.\d+))|(:?[A-Za-z][^-`~@#%^&()=+[{}|;:'",<>/.*\]\s\\!?]*[!?]?)/
}

// Seach document symbols
export function getSymbols(uri): Thenable<vscode.SymbolInformation[]> {
	return vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", uri)
}

// Execute crystal tools.
export function spawnPromise(document, position, command, key, searchProblems) {
	return new Promise(function (resolve, reject) {
		let response = ""
		const config = vscode.workspace.getConfiguration("crystal-lang")
		if (Concurrent.counter < Concurrent.limit() && config[key]) {
			let scope = mainFile(document.fileName)
			Concurrent.counter += 1
			statusBarItem.text = `${config["compiler"]} tool ${command} is working...`
			statusBarItem.show()
			let child = spawn(`${config["compiler"]}`, [
				"tool",
				command,
				"-c",
				`${document.fileName}:${position.line + 1}:${position.character + 1}`,
				`${scope}`,
				"--no-color",
				"--error-trace",
				"-f",
				"json"
			], { cwd: ROOT, env: ENV })
			child.stdout.on("data", (data) => {
				response += data
			})
			child.stdout.on("end", () => {
				searchProblems(response.toString(), document.uri)
				Concurrent.counter -= 1
				statusBarItem.hide()
				return resolve(response)
			})
			child.on("error", (err) => {
				vscode.window.showErrorMessage("Crystal compiler not found. " + err.message)
				console.error(err.message)
			})
		} else if (config[key]) {
			return resolve(`{"status":"blocked"}`)
		} else {
			return resolve("")
		}
	})
}

// Execute crystal compiler or parser.
export function spawnLocal(document, build, searchProblems) {
	let response = ""
	let scope = mainFile(document.fileName)
	const config = vscode.workspace.getConfiguration("crystal-lang")
	let options
	if (build) {
		options = [
			"build",
			"--no-debug",
			"--no-color",
			"--no-codegen",
			"--error-trace",
			`${scope}`,
			"-f",
			"json"
		]
		Concurrent.counter += 1
		statusBarItem.text = `${config["compiler"]} build --no-codegen is working...`
		statusBarItem.show()
	} else {
		options = [
			"tool",
			"format",
			"--check",
			"--no-color",
			"-f",
			"json",
			`${document.fileName}`
		]
	}
	let child = spawn(`${config["compiler"]}`, options, { cwd: ROOT, env: ENV })
	child.stdout.on("data", (data) => {
		response += data
	})
	child.stdout.on("end", () => {
		searchProblems(response.toString(), document.uri)
		if (build) {
			Concurrent.counter -= 1
			statusBarItem.hide()
		}
	})
	child.on("error", (err) => {
		vscode.window.showErrorMessage("Crystal compiler not found. " + err.message)
		console.error(err.message)
	})
}
