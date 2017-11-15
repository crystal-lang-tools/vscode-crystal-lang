//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as utils from '../src/crystalUtils';
import { isNotKeyword } from '../src/crystalUtils';

var config = vscode.workspace.getConfiguration("crystal-lang");

// Defines a Mocha test suite to group tests of similar kind together
suite("Common Utils", () => {

	test("Concurrent class", () => {
		assert.equal(utils.Concurrent.counter, 0);
		utils.Concurrent.counter += 1
		assert.equal(utils.Concurrent.counter, 1);
		assert.equal(utils.Concurrent.limit(), 3);
		assert.equal(utils.Concurrent.limit() > utils.Concurrent.counter, true);
		utils.Concurrent.counter += 2
		assert.equal(utils.Concurrent.counter, 3);
		assert.equal(utils.Concurrent.limit() > utils.Concurrent.counter, false);
	})

	test("Verify keywords", () => {
		assert.equal(utils.isNotKeyword("def"), false)
		assert.equal(utils.isNotKeyword("foo"), true)
	})

	test("Verify libs", () => {
		assert.equal(utils.isNotLib("/foo/bar"), true)
		assert.equal(utils.isNotLib("lib"), false)
	})

	test("Search problems on compiler output", () => {
		assert.equal(utils.searchProblems("", new vscode.Uri).length, 0)
		assert.equal(utils.searchProblems(`[{"file":"","line":1,"column":1,"size":null,"message":"for empty hashes use '{} of KeyType => ValueType'"}]`, new vscode.Uri).length, 1)
	})

	// -----------------------
	// TODO: create more tests
	// -----------------------
})