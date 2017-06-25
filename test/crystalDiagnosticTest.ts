
import { spawn } from 'child_process'

export class CrystalDiagnosticTest {

	/**
	 * Execute crystal build to check problems.
	 */
	crystalDoDiagnostic(document) {
		return new Promise((resolve, reject) => {
			let response = ''
			let child = spawn('crystal', ['tool', 'format', '--no-color', '-f', 'json', '-'])
			child.stdin.write(document)
			child.stdin.end()
			child.stdout.on('data', (data) => {
				response += data
			})
			child.stdout.on('end', () => {
				return resolve(response)
			})
		})
	}
}