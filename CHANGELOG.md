# Change Log

## [Unreleased]
### Todo
- Full Support for Language Server Protocol.
- Complete TODO's comments inside this source code.
- Solve issues in Github repo.
- Autogenerate completion data.
- Rewrite/Improve completion algorithm.

## [0.2.14] - 2017-08-09
### Fix
- Issue #15

## [0.2.13] - 2017-08-08
### Change
- Refactoring hover provider.
- Settings descriptions.
- Clean completion data.

### Add
- Option to configure compiler path.
- Error messages.
- New Gif on README showing hover feature.
- Add --error-trace flag.

### Fix
- Allow to disable features completely.

## [0.2.11] - 2017-08-06
### Change
- Remove `win32` error messages and restrictions.

## [0.2.10] - 2017-08-02
### Fix
- Problem locations on templates [#11](https://github.com/faustinoaq/vscode-crystal-lang/pull/11)

## [0.2.9] - 2017-08-02
### Fix
- Macro issue [#10](https://github.com/faustinoaq/vscode-crystal-lang/pull/10)

## [0.2.8] - 2017-07-31
### Fix
- Macro issue [#5](https://github.com/faustinoaq/vscode-crystal-lang/issues/5).

### Add
- Allow to use `${workspaceRoot}` on `mainFile`.

## [0.2.7] - 2017-07-29
### Fix
- Syntax issues [#7](https://github.com/faustinoaq/vscode-crystal-lang/issues/7), [#8](https://github.com/faustinoaq/vscode-crystal-lang/issues/8), [#9](https://github.com/faustinoaq/vscode-crystal-lang/pull/9).

## [0.2.6] - 2017-07-28
### Change
- Translate Crystal syntax from `.tmLanguage` to `.json`.
- Update README.

### Add
- Slang syntax and snippets.

### Fix
- Snippets.

## [0.2.5] - 2017-07-27
### Change
- Disable onDidChangeTextDocument to improve performance.

## [0.2.4] - 2017-07-20
### Change
- Remove scry binary.
- Remove node-7z package.
- Now server path is needed to activate Scry.
- Replace implementation provider by definition provider.
- Check that crystal exists on path.
- Update README.
- Enable features by default.

## [0.2.3] - 2017-07-10
### Change
- Update scry.
- Language-client to old version to avoid initialize message error.

### Add
- Improve performance.
- Method `each` and `join` to completion.

## [0.2.2] - 2017-07-1
### Add
- <%= snippet.

### Fix
- Formatter bug when old file is bigger than new one.
- Add big binary to `.vscodeignore`, just keep compressed version.

### Change
- Remove some `console.info`, because too much logging.

## [0.2.0] - 2017-06-30
### Add
- Add experimental support for Language Server Protocol using [Scry](https://github.com/faustinoaq/scry).

### Fix
- Fix Content-Length bug, related [#25](https://github.com/palantir/python-language-server/issues/25)
- Fix npm dependencies

## [0.1.7] - 2017-06-28
### Change
- Improve completion algorithm

### Fix
- Typos

## [0.1.5] - 2017-06-27
### Fix
- Enable completion support on Windows

## [0.1.4] - 2017-06-27
### Add
- File method completion

## [0.1.3] - 2017-06-27
### Fix
- Subtypes completion

## [0.1.2] - 2017-06-26
### Add
- Basic symbols completion on Windows

### Fix
- Improve completion algorithm
- Fix typos

## [0.1.1] - 2017-06-26
### Change
- Symbols support on Windows

### Fix
- Fix package.json
- Fix output messages

## [0.0.9] - 2017-06-25
### Add
- Show types on Hover
- Peek and Go to Implementations
- Show document symbols
- Symbols suggestions
- Instance Method suggestions
- Images and documentation
- initialize method snippet
- StatusBar messages

### Fix
- Typos in documentation
- ECR snippet each

## [0.0.8] - 2017-06-22
### Change
- Refactoring source code

### Add
- Linter levels: syntax, build and none.
- README new gifs and documentation.
- ECR Snnipets

### Fix
- ECR Syntax.
- CRYSTAL_PATH issues when using shards.

## [0.0.7] - 2017-06-19
### Fix
- ECR syntax.
- `win32` error messages.

## [0.0.6] - 2017-06-18
### Fix
- Bug when `response` is empty [#4590](https://github.com/crystal-lang/crystal/issues/4590)

## [0.0.5] - 2017-06-18
### Change
- Refactoring files

### Fix
- Buffer `spawn` waits until `end` event.
- Remove `fileName` redundancy.
- Auto identation.

### Add
- `select` snippet.
- Formatting in Untitled windows.
- Clean `crystal.tmLanguage`

## [0.0.4] - 2017-06-11
### Fix
- Filepath with spaces or special characters.

## [0.0.3] - 2017-06-11
### Changed
- Formatter: use stdout instead of temp file and use analyzeDocument to check errors.
- Linter: split into validateFile and analyzeDocument.
- Snippets: fix warnings.

## [0.0.2] - 2017-06-11
### Added
- Formatter.
- Linter.
- ECR syntax.
- Auto identation.
- More snippets.

## [0.0.1] - 2017-06-02
### Added
- Syntax highlighting.
- Snippets.
