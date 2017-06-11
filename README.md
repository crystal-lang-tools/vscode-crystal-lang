# VSCode Extension for Crystal Language

Yet another VSCode extension for Crystal Programming Language.

## Configuration

```javascript
{
  "crystal-lang.verifyFiles": true, // enable crystal linter, disabled by default
  "crystal-lang.maxNumberOfProblems": 10, // Max amount of problems by crystal build
  "crystal-lang.mainFile": "/absolute/src/file/path" // Use absolute path (${} variables don't work)
}
```

## Features

* Syntax highlighting for `.cr` and `.ecr`
* Code snippets for `.cr` files
* Increment and decrement identation
* Formatting code using `crystal tool format`
* Linter using `crystal build --no-color --no-codegen -f json`

![crystal cup example code](http://i.imgur.com/L1Xdm7A.png)

Syntax and snippets are based on [Crystal documentation](https://crystal-lang.org/docs/).

## Based on these extensions

* [vscode-crystal](https://github.com/g3ortega/vscode-crystal): syntax highlighting and useful framework snippets.
* [crystal-ide](https://github.com/kofno/crystal-ide): syntax highlighting and error checking.
* [vscode-elixir](https://github.com/fr1zle/vscode-elixir): language support.
* [vscode-nim](https://github.com/pragmagic/vscode-nim): language support.

## Roadmap

* Implement more vscode features like [Nim](https://github.com/fr1zle/vscode-nim) and [Elixir](https://github.com/fr1zle/vscode-elixir) extensions.

## Knows issues

* Linter and formatter are implemented using Node.js `exec` so perfomance could be affected.
* Linter is disabled by default, enable using `"crystal-lang.verifyFiles": true`
* Formatter creates temp file because `crystal tool format` don't print to stdout. [#1863](https://github.com/crystal-lang/crystal/issues/1863)
* ECR syntax is very basic, some keywords aren't highlighted. You can use vscode text.html instead.
* Some errors can't be detected because `crystal` (0.22.0) don't use `stderr`. [#4494](https://github.com/crystal-lang/crystal/pull/4494)

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