"use strict";
//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
exports.__esModule = true;
// The module 'assert' provides assertion methods from node
var assert = require("assert");
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
var crystalDiagnosticTest_1 = require("./crystalDiagnosticTest");
// Defines a Mocha test suite to group tests of similar kind together
// ---------------------------------------------------------------------------------
// Run mocha with ./node_modules/mocha/bin/mocha --ui tdd out/test/extension.test.js
// ---------------------------------------------------------------------------------
suite("Extension Tests", function () {
    var CODE_WITH_ERROR = 'variable = {}';
    var CODE_BAD_FORMAT = 'variable  :   String  =  ""';
    var CODE_FORMATED = 'variable : String = ""\n';
    var EMPTY_HASH_ERROR = "[{\"file\":\"\",\"line\":1,\"column\":12,\"size\":null,\"message\":\"for empty hashes use '{} of KeyType => ValueType'\"}]\n";
    var diagnostic = new crystalDiagnosticTest_1.CrystalDiagnosticTest();
    test("crystal error", function () { return __awaiter(_this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, diagnostic.crystalDoDiagnostic(CODE_WITH_ERROR)];
                case 1:
                    response = _a.sent();
                    assert.equal(response.toString(), EMPTY_HASH_ERROR);
                    return [2 /*return*/];
            }
        });
    }); });
    test("crystal formatting", function () { return __awaiter(_this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, diagnostic.crystalDoDiagnostic(CODE_BAD_FORMAT)];
                case 1:
                    response = _a.sent();
                    assert.equal(response.toString(), CODE_FORMATED);
                    return [2 /*return*/];
            }
        });
    }); });
});
