//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { CrystalDiagnosticTest } from './crystalDiagnosticTest'

// Defines a Mocha test suite to group tests of similar kind together
// ---------------------------------------------------------------------------------
// Run mocha with ./node_modules/mocha/bin/mocha --ui tdd out/test/extension.test.js
// ---------------------------------------------------------------------------------
suite("Extension Tests", () => {

	const CODE_WITH_ERROR = 'variable = {}'
	const CODE_BAD_FORMAT = 'variable  :   String  =  ""'
	const CODE_FORMATED = 'variable : String = ""\n'
	const EMPTY_HASH_ERROR = `[{"file":"","line":1,"column":12,"size":null,"message":"for empty hashes use '{} of KeyType => ValueType'"}]\n`
	let diagnostic = new CrystalDiagnosticTest()

	test("crystal error", async () => {
		let response = await diagnostic.crystalDoDiagnostic(CODE_WITH_ERROR)
		assert.equal(response.toString(), EMPTY_HASH_ERROR)
	})

	test("crystal formatting", async () => {
		let response = await diagnostic.crystalDoDiagnostic(CODE_BAD_FORMAT)
		assert.equal(response.toString(), CODE_FORMATED)
	})
})