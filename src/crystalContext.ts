import * as vscode from 'vscode'
import { spawn } from 'child_process'
import { statusBarItem } from "./crystalStatusBar"

import { ENV, ROOT, Concurrent, mainFile, isNotLib } from "./crystalConfiguration"
import { CrystalProblemsFinder } from "./crystalProblemsFinder"

export class CrystalContext extends CrystalProblemsFinder {
	/**
	 * Execute crystal tool context for current file:position
	 * and do syntax checking too.
	 */
	crystalContext(document, position, mode) {
		let self = this
		return new Promise(function (resolve, reject) {
			let response = ''
			const config = vscode.workspace.getConfiguration('crystal-lang')
			if (Concurrent.counter < Concurrent.limit() && config[mode]) {
				let scope = mainFile(document.fileName)
				Concurrent.counter += 1
				statusBarItem.text = `${config['compiler']} tool context is working...`
				statusBarItem.show()
				let child = spawn(`${config['compiler']}`, [
					'tool',
					'context',
					'-c',
					`${document.fileName}:${position.line + 1}:${position.character + 1}`,
					`${scope}`,
					'--no-color',
					'--error-trace',
					'-f',
					'json'
				], { cwd: ROOT, env: ENV })
				child.stdout.on('data', (data) => {
					response += data
				})
				child.stdout.on('end', () => {
					self.searchProblems(response.toString(), document.uri)
					Concurrent.counter -= 1
					statusBarItem.hide()
					return resolve(response)
				})
				child.on('error', (err) => {
					vscode.window.showErrorMessage('Crystal compiler not found. ' + err.message)
					console.error(err.message)
				})
			} else if (config[mode]) {
				console.info('INFO: crystal is taking a moment to check context')
				return resolve('{"status":"blocked"}')
			} else {
				return resolve('{"status":"disabled"}')
			}
		})
	}
}