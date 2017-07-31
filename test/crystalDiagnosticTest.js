"use strict";
exports.__esModule = true;
var child_process_1 = require("child_process");
var CrystalDiagnosticTest = (function () {
    function CrystalDiagnosticTest() {
    }
    /**
     * Execute crystal build to check problems.
     */
    CrystalDiagnosticTest.prototype.crystalDoDiagnostic = function (document) {
        return new Promise(function (resolve, reject) {
            var response = '';
            var child = child_process_1.spawn('crystal', ['tool', 'format', '--no-color', '-f', 'json', '-']);
            child.stdin.write(document);
            child.stdin.end();
            child.stdout.on('data', function (data) {
                response += data;
            });
            child.stdout.on('end', function () {
                return resolve(response);
            });
        });
    };
    return CrystalDiagnosticTest;
}());
exports.CrystalDiagnosticTest = CrystalDiagnosticTest;
