# Change Log

## [0.9.7] - 2025-01-20

### Change

- Don't start new line as comment if current line is a comment [#205](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/205)

## [0.9.6] - 2024-09-29

### Fix

- Use separate cache directory for each project / target [#201](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/201)

## [0.9.5] - 2024-07-05

### Add

- Add configuration option `crystal-lang.server-env` for adding environment variables to be passed to the LSP

## [0.9.4] - 2024-05-16

### Add

- Add configuration option `crystal-lang.disable-gc` to disable the garbage collector when running compiler tools.

## [0.9.3] - 2024-03-01

### Fix

- Don't highlight unused after macro interp [#190](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/190)
- Don't autocomplete in comments [#178](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/178)
- Spec bug fix
- Improve word pattern regex to not match colons preceding namespaces

## [0.9.2] - 2024-02-20

### Fix

- Add highlighting for built-in spec keywords [#186](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/186)
- Add keywords to autocomplete [#187](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/187)
- Don't highlight method calls as unused [#188](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/188)

## [0.9.1] - 2024-02-06

### Fix

- V 0.9 won't catch some errors [#183](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/183)
- Spawn problem tool if `crystal tool dependencies` failed
- General formatting

## [0.9.0] - 2024-02-01

### Fix

- Color change when adding return type to class method [#157](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/157)
- Error executing Crystal plugin. spawn crystal ENOENT [#102](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/102),
  Error executing Crystal plugin. spawn bash ENOENT in Windows [#172](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/172)
- Auto-formatting issue with some keywords [#158](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/102)
- Hover feature does not work with Windows11 PC and v0.8.4 of the extension (Native Windows Crystal, not WSL) [#176](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/176)
- With compiler path set properly still get error upon opening first .cr file [#177](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/177)
- Max processes not respected (there's now only one instance of the compiler running at once) [#122](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/122)
- Use a separate task provider for shards (thanks @refi64) [#145](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/145)
- Stop the LSP when the extension is shutting down, where previously it would just stay on / active

### Add

- Ability to view and debug expanded source code from macros [#4](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/4)
- Add support for Jump to Definition [#42](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/42)
- Crystal support in Markdown code blocks [#56](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/56)
- Add Crystal Specs to native Testing UI (disabled by default for user-experience) [#163](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/163)
- Supporting mutiple main files (entry points) for a single project [#175](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/175)
- Add unused variable highlighting (thanks @grkek) [#155](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/155)
- make Crystal grammar compatible with TextMate (thanks @WhereIsX) [#150](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/150)
- GitHub Codespaces support (as long as Crystal is installed)
- Show problems in ECR files

## [0.6.0] - 2020-09-19

### Fix
- Upgraded depencencies done by [elbywan](https://github.com/elbywan) [#126](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/126)


## [0.5.0] - 2020-09-19

This new minor version has many fixes done by crystal lang community, see: [Crystal Lang Tools](https://github.com/crystal-lang-tools/vscode-crystal-lang)

### Fix
- Update block snippets by [MatheusRich](https://github.com/MatheusRich) [#109](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/109)
- Use `crystal env CRYSTAL_PATH` to get Crystal stdlib path by [MakeNowJust](https://github.com/MakeNowJust) [#115](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/115)
- upgrade yaml version and fix import by [zhenfeng-zhu](https://github.com/zhenfeng-zhu) [#118](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/118)
- Explicitly set UTF-8 encoding when formatting by [lmatayoshi]() [#121](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/121)


## [0.4.0] - 2020-03-30

This new minor version has many fixes done by crystal lang community, see: [Crystal Lang Tools](https://github.com/crystal-lang-tools/vscode-crystal-lang)

### Add
- Improve TypeScript config by [Massimiliano Bertinetti](https://github.com/Acciaiodigitale) [#92](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/92)
- Add offsetof keyword by by [Massimiliano Bertinetti](https://github.com/Acciaiodigitale) [#94](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/94)
- Refactor and adding support for literal with type numeric by by [Andra Antariksa](https://github.com/andraantariksa) [#103](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/103)
- Add snippets for testing with Spec by [Massimiliano Bertinetti](https://github.com/Acciaiodigitale) [#90](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/90)
- Use incremental build by [fabon](https://github.com/fabon-f)
- Update TypeScript version by [fabon](https://github.com/fabon-f)
- Add offsetof keyword by [malte-v](https://github.com/malte-v)
- Add #describe and #it snippets by [reiswindy](https://github.com/reiswindy)

### Fix
- bumped minimist version for vulnerability issue by [Massimiliano Bertinetti](https://github.com/Acciaiodigitale) [#107](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/107)
- Fixed problems with formatting the code with errors by [speles](https://github.com/speles) [#99](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/99)

## [0.3.14] - 2019-02-08
### Fix
- Makes syntax error matching backward compatible (< 0.27.2)

## [0.3.13] - 2019-02-08
### Fix
- Whole buffer replaced with syntax error [#84](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/84)

## [0.3.12] - 2019-02-06
### Fix
- Detect Error messages

## [0.3.11] - 2019-02-06
### Add
- Add `out` as a keyword [#50](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/50)
- Adds fresh variables to the syntax [#53](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/53)
- Restricting language services to local files [#54](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/54)
- Task provider support [#77](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/77)
- Improve crystal syntaxes [#76](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/76)

### Fix
- Fix typo and spawn description [#55](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/55)
- edit:package.json categories from Languages to Programming Languages by @dengjie
- fix: syntaxes json back to 0.10 cause master is not work by @dengjie
- fix:add trigger string '.' use completion hint by @dengjie
- Fix typo in changelog [#60](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/60)
- Fix Crystal 0.27 snippets [#75](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/75)
- Corrected regex issue and covered dotted fresh variables [#57](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/57)
- Crystal command hanging on windows [#59](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/59)
- Remove format flag [#80](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/80)

### Changes
- Manually handle go-to-definition of local requires [#78](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/78)

## [0.3.10] - 2018-02-07
### Fix
- Diagnostics doesn't work [#47](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/47)

### Changes
- Indentation pattern based on vscode-ruby [#46](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/46)

## [0.3.9] - 2017-11-15
### Add
- Test integration [#41](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/41).

### Fix
- Loading... bug [#38](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/38).
- Case of NamedTuple suggestion [#37](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/37).

## [0.3.8] - 2017-11-11
### Add
- Add `previous_def` as a keyword [#36](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/36).
- New snippets for `uninitilialized` and `previous_def`.

## [0.3.7] - 2017-10-27
### Fix
- Fix octal hightlighting issue [#31](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/31).

### Changes
- Add new gif demo

## [0.3.6] - 2017-10-21
### Fix
- Fix [#28](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/28).
- Fix null line issue and column zero.

### Changes
- Refactor CrystalDocumentSymbolProvider methods.
- Update [keywords list](https://github.com/crystal-lang/crystal/wiki/Crystal-for-Rubyists#available-keywords).

## [0.3.5] - 2017-10-13
### Changes
- Update dependencies.
- Add inline block snippets.
- Fix highlighting issues, see [#27] (https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/27) thanks to [@straight-shoota](https://github.com/straight-shoota).

## [0.3.4] - 2017-09-24
### Fix
- Issues [#18](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/21), [#21](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/21).

### Add
- Snippets [#22](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/22).

### Change
- Remove variable assignations from symbol list.

## [0.3.3] - 2017-08-30
### Add
- Gif icon.

## [0.3.2] - 2017-08-29
### Change
- Default settings.
- Disable unfinished features.
- Update dependencies.

## [0.3.1] - 2017-08-15
### Add
- Channel method completion.

## [0.3.0] - 2017-08-15
### Add
- Update repository links to Crystal Tools organization.
- Some completion methods for common classes.
- Bash on Windows support.
- Wiki.

## [0.2.17] - 2017-08-10
### Change
- Adds more info on hover.
- Clean code.
- Update README.
- Rename crystalConfiguration.ts to crystalUtils.ts

## [0.2.16] - 2017-08-09
### Change
- Update README.

### Fix
- Allow to disable completion.
- Allow to disable symbol information on hover.

## [0.2.14] - 2017-08-09
### Fix
- Issue [#15](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/15).

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
- Problem locations on templates [#11](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/11)

## [0.2.9] - 2017-08-02
### Fix
- Macro issue [#10](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/10)

## [0.2.8] - 2017-07-31
### Fix
- Macro issue [#5](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/5).

### Add
- Allow to use `${workspaceRoot}` on `mainFile`.

## [0.2.7] - 2017-07-29
### Fix
- Syntax issues [#7](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/7), [#8](https://github.com/crystal-lang-tools/vscode-crystal-lang/issues/8), [#9](https://github.com/crystal-lang-tools/vscode-crystal-lang/pull/9).

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
- Add experimental support for Language Server Protocol using [Scry](https://github.com/crystal-lang-tools/scry).

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
