# VSCode Extension for Crystal Language

This extension provides basic language support for Crystal and [ECR](https://crystal-lang.org/api/latest/ECR.html).

![crystal icon](http://i.imgur.com/GoiQmzC.gif)

## Features

* Increment and decrement identation
* Formatting code support
* Syntax highlighting
* Linter support
* Snippets

## Configuration

Your `settings.json` with this extension configuration:

```json
{
  "crystal-lang.problems": "syntax",
  "crystal-lang.problemsLimit": 10,
  "crystal-lang.mainFile": "/absolute/src/file/path"
}
```

### problems

`crystal-lang.problems` allow to set diferents error levels. By default the linter just check syntax errors. The options are:

- **syntax**: check syntax and tokens (default).
- **build**: check requires, objects and methods (resource heavy).
- **none**: disable linter.

```json
{
	"crystal-lang.problems": "syntax | build | none",
}
```

### poblemsLimit

`crystal-lang.problemsLimit` allow to limit the amount of problems that appears in problems view. The default value is 20.

### mainFile

`crystal-lang.mainFile` works only when `crystal-lang.problems = "build"` because the extension needs to compile your code to get more info about problems but without generate an executable.

This option is more resource heavy that the aboves.

## Screenshots

### Increment and decrement identation

![identation](http://i.imgur.com/V15TxFb.gif)

### Formatting code support

![formatting](http://i.imgur.com/VTeOkOm.gif)

### Syntax highlighting

![ecr](http://i.imgur.com/w9aBlIH.gif)


### Linter support

![linter](http://i.imgur.com/ukl1jyg.gif)

### Snippets

![snippets](http://i.imgur.com/GNICZSH.gif)

### Debugging

[Native Debug](https://marketplace.visualstudio.com/items?itemName=webfreak.debug) is an excelent extension that allow you to debug crystal and other languages that compile to binary.

> Be sure of compile your crystal code with `--debug` flag

![Native Debug extension](http://i.imgur.com/mrJzrxI.png)

### Icon theme

You can use [Nomo Dark icon theme](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-icontheme-nomo-dark) to see crystal icon:

![Nomo Dark icon theme](http://i.imgur.com/6QxIyWV.png)

## Roadmap

- Referencies (using `crystal tool implementations`).
- Completions (using `crystal tool types`).
- Symbols (using `crystal tool hierarchy`).
- Hover (using `crystal tool context`).
- Syntax using JSON instead of XML.
- Support for Language Server Protocol, see [Scry](https://github.com/kofno/scry)

## Know issues

1. Linter is disabled by default, enable using `"crystal-lang.problems": true`
2. Linter and formatter are implemented using Node.js `child_process` so perfomance could be affected. You can use a different problem level.

3. ECR syntax is very basic, some keywords aren't highlighted. You can use vscode `text.html` instead or enable emmet for `text.ecr` in your `settings.json`:

```json
{
  "emmet.syntaxProfiles": {
    "ecr": "html"
  }
}
```

4. Some errors can't be detected because `crystal` (0.22.0) don't use `stderr`. [#4494](https://github.com/crystal-lang/crystal/pull/4494)


## Release Notes

See [Changelog](https://github.com/faustinoaq/vscode-crystal-lang/blob/master/CHANGELOG.md)

## Contributing

1. Fork it https://github.com/faustinoaq/vscode-crystal-lang/fork
2. Create your feature branch `git checkout -b my-new-feature`
3. Commit your changes `git commit -am 'Add some feature'`
4. Push to the branch `git push origin my-new-feature`
5. Create a new Pull Request

## Contributors

- [@faustinoaq](https://github.com/faustinoaq) Faustino Aguilar - creator, maintainer