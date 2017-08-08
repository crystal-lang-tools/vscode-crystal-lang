
import * as vscode from 'vscode'
import { spawn } from 'child_process'

import { statusBarItem } from "./crystalStatusBar";
import { ENV, Concurrent, mainFile, isNotLib, ROOT } from "./crystalConfiguration";
import { CrystalProblemsFinder } from "./crystalProblemsFinder";

export class CrystalDiagnostic extends CrystalProblemsFinder {

	/**
	 * Execute crystal build to check problems.
	 */
	crystalDoDiagnostic(document: vscode.TextDocument) {
		let response = ''
		const config = vscode.workspace.getConfiguration('crystal-lang')
		if (config['problems'] == 'syntax') {
			let child = spawn(`${config['compiler']}`, ['tool', 'format', '--check', '--no-color', '-f', 'json', '-'])
			child.stdin.write(document.getText())
			child.stdin.end()
			child.stdout.on('data', (data) => {
				response += data
			})
			child.stdout.on('end', () => {
				this.searchProblems(response, document.uri)
			})
			child.on('error', (err) => {
				vscode.window.showErrorMessage('Crystal compiler not found. ' + err.message)
				console.error(err.message)
			})
			child.on('exit', (exitCode) => {
				if (exitCode != 0) {
					// console.error('ERROR: crystal tool format --check exit with code ' + exitCode)
					// console.info('INFO: not formatted or syntax error or crystal bug')
				}
			})
		} else if (Concurrent.counter < Concurrent.limit() && config['problems'] == 'build' && isNotLib(document.fileName)) {
			let scope = mainFile(document.fileName)
			Concurrent.counter += 1
			statusBarItem.text = `${config['compiler']} build --no-codegen is working...`
			statusBarItem.show()
			let child = spawn(`${config['compiler']}`, [
				'build',
				'--no-debug',
				'--no-color',
				'--no-codegen',
				'--error-trace',
				`${scope}`,
				'-f',
				'json'
			], { cwd: ROOT, env: ENV })
			child.stdout.on('data', (data) => {
				response += data
			})
			child.stdout.on('end', () => {
				this.searchProblems(response.toString(), document.uri)
				Concurrent.counter -= 1
				statusBarItem.hide()
			})
			child.on('error', (err) => {
				vscode.window.showErrorMessage('Crystal compiler not found. ' + err.message)
				console.error(err.message)
			})
			child.on('exit', (exitCode) => {
				if (exitCode != 0) {
					// console.error('ERROR: crystal build exit with code ' + exitCode)
					// console.info('INFO: file not found or build error or crystal bug')
				}
			})
		} else if (config['problems'] != 'none') {
			// console.error('ERROR: processesLimit has been reached')
			console.info('INFO: crystal is taking a moment to build')
		}
	}
}

