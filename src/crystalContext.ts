import * as vscode from 'vscode'
import { spawn } from 'child_process'
import { statusBarItem } from "./crystalStatusBar";

import { ENV, CrystalLimit } from "./crystalConfiguration";
import { CrystalProblemsFinder } from "./crystalProblemsFinder";

export class CrystalContext extends CrystalProblemsFinder {
	/**
	 * Execute crystal tool context for current file:position
	 * and do syntax checking too.
	 */
	crystalContext(document, position, mode) {
		let self = this
		return new Promise(function (resolve, reject) {
			let config = vscode.workspace.getConfiguration('crystal-lang')
			let response = ''
			if (CrystalLimit.processes < CrystalLimit.limit() && config[mode]) {
				let scope: string
				if (config['mainFile'] == '') {
					scope = document.fileName
				} else {
					scope = config['mainFile']
				}
				CrystalLimit.processes += 1
				statusBarItem.text = 'crystal tool context is working...'
				statusBarItem.show()
				let child = spawn('crystal', [
					'tool',
					'context',
					'-c',
					`${document.fileName}:${position.line + 1}:${position.character + 1}`,
					`${scope}`,
					'--no-color',
					'-f',
					'json'
				], { env: ENV })
				child.stdout.on('data', (data) => {
					response += data
				})
				child.stdout.on('end', () => {
					self.searchProblems(response.toString(), document.uri)
					CrystalLimit.processes -= 1
					statusBarItem.hide()
					return resolve(response)
				})
				child.on('exit', (exitCode) => {
					if (exitCode != 0) {
						console.error('ERROR: crystal tool context exit with code ' + exitCode)
						console.error('EINFO: code error or crystal bug')
					}
				})
			} else if (config[mode]) {
				console.error('ERROR: processesLimit has been reached')
				console.error('EINFO: crystal is taking a moment to check context')
				return resolve('{"status":"blocked"}')
			} else {
				return resolve('{"status":"disabled"}')
			}
		})
	}
}