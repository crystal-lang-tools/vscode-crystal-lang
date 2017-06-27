# Change Log

## [Unreleased]
### Todo
- Translate Crystal syntax from `.tmLanguage` to `.json`.
- Support for Language Server Protocol.
- Complete TODO's comments inside this source code.

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