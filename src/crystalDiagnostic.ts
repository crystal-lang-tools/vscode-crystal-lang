
import * as vscode from 'vscode'
import { spawn } from 'child_process'

import { statusBarItem } from "./crystalStatusBar";
import { ENV, CrystalLimit } from "./crystalConfiguration";
import { CrystalProblemsFinder } from "./crystalProblemsFinder";

export class CrystalDiagnostic extends CrystalProblemsFinder {

	/**
	 * Execute crystal build to check problems.
	 */
	crystalDoDiagnostic(document: vscode.TextDocument) {
		let config = vscode.workspace.getConfiguration('crystal-lang')
		let response = ''
		if (config['problems'] == 'syntax') {
			let child = spawn('crystal', ['tool', 'format', '--check', '--no-color', '-f', 'json', '-'])
			child.stdin.write(document.getText())
			child.stdin.end()
			child.stdout.on('data', (data) => {
				response += data
			})
			child.stdout.on('end', () => {
				this.searchProblems(response, document.uri)
			})
			child.on('exit', (exitCode) => {
				if (exitCode != 0) {
					console.error('ERROR: crystal tool format --check exit with code ' + exitCode)
					console.error('EINFO: not formatted or syntax error or crystal bug')
				}
			})
		} else if (CrystalLimit.processes < CrystalLimit.limit() && config['problems'] == 'build') {
			let scope: string
			if (config['mainFile'] == '') {
				scope = document.fileName
			} else {
				scope = config['mainFile']
			}
			CrystalLimit.processes += 1
			statusBarItem.text = 'crystal build --no-codegen is working...'
			statusBarItem.show()
			let child = spawn('crystal', [
				'build',
				'--no-debug',
				'--no-color',
				'--no-codegen',
				`${scope}`,
				'-f',
				'json'
			], { env: ENV })
			child.stdout.on('data', (data) => {
				response += data
			})
			child.stdout.on('end', () => {
				this.searchProblems(response.toString(), document.uri)
				CrystalLimit.processes -= 1
				statusBarItem.hide()
			})
			child.on('exit', (exitCode) => {
				if (exitCode != 0) {
					console.error('ERROR: crystal build exit with code ' + exitCode)
					console.error('EINFO: file not found or build error or crystal bug')
				}
			})
		} else if (config['problems'] != 'none') {
			console.error('ERROR: processesLimit has been reached')
			console.error('EINFO: crystal is taking a moment to build')
		}
	}
}

