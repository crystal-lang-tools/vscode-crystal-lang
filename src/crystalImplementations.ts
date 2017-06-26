'use strict'
import * as vscode from 'vscode'
import { spawn } from 'child_process'
import { dirname } from 'path'

import { CrystalProblemsFinder } from './crystalProblemsFinder'
import { ENV, CrystalLimit } from './crystalConfiguration';
import { statusBarItem } from './crystalStatusBar';

export class CrystalImplementationsProvider extends CrystalProblemsFinder implements vscode.ImplementationProvider {

	/**
	 * Execute crystal tool context for current file:position
	 * and do syntax checking too if enabled.
	 */
	crystalImplementations(document: vscode.TextDocument, position: vscode.Position) {
		let self = this
		return new Promise(function (resolve, reject) {
			let config = vscode.workspace.getConfiguration('crystal-lang')
			let response = ''
			if (CrystalLimit.processes < CrystalLimit.limit() && config['implementations']) {
				let scope: string
				if (config['mainFile'] == '') {
					scope = document.fileName
				} else {
					scope = config['mainFile']
				}
				CrystalLimit.processes += 1
				statusBarItem.text = 'crystal tool implemetations is working...'
				statusBarItem.show()
				let child = spawn('crystal', [
					'tool',
					'implementations',
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
						console.error('ERROR: crystal tool implementations exit with code ' + exitCode)
						console.info('INFO: code error or crystal bug')
					}
				})
			} else if (config['implementations']) {
				console.error('ERROR: processesLimit has been reached')
				console.info('INFO: crystal is taking a moment to check implementation')
				return resolve('')
			} else {
				return resolve('{"status":"disabled"}')
			}
		})
	}

	async provideImplementation(document: vscode.TextDocument, position: vscode.Position) {
		let crystalOutput = await this.crystalImplementations(document, position)
		let locations: vscode.Location[] = []
		if (crystalOutput.toString().startsWith('{"status":"')) {
			try {
				let crystalMessageObject = JSON.parse(crystalOutput.toString())
				if (crystalMessageObject.status == 'ok') {
					for (let element of crystalMessageObject.implementations) {
						let position = new vscode.Position(element.line - 1, element.column - 1)
						let location = new vscode.Location(vscode.Uri.file(element.filename), position)
						locations.push(location)
					}
				} else if (crystalMessageObject.status == 'disabled') {
					console.error('INFO: crystal implementations are disabled')
				}
			} catch (err) {
				console.error('JSON.parse failed to parse crystal implementations output')
				throw err
			}
		}
		return locations
	}
}
