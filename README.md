# VSCode Extension for Crystal Language

This extension provides support for The [Crystal](https://github.com/crystal-lang) programming language.

![crystal icon](https://i.imgur.com/GoiQmzC.gif)

- [1. Features](#1-features)
- [2. Requirements](#2-requirements)
- [3. Configuration](#3-configuration)
- [4. Messages](#4-messages)
- [5. Know issues](#5-know-issues)
- [6. More Screenshots](#6-more-screenshots)
- [7. Roadmap](#7-roadmap)
- [8. Release Notes](#8-release-notes)
- [9. Contributing](#9-contributing)
- [10. Contributors](#10-contributors)

## 1. Features

* Snippets
* Formatting
* Problems finder
* Document Symbols
* Show variable type on Hover
* Show and Peek Implementations
* Increment and decrements indentation
* Method completion for Literals and Symbols
* Syntax highlighting for Crystal, [ECR](https://crystal-lang.org/api/latest/ECR.html) and [Slang](https://github.com/jeromegn/slang)

## 2. Requirements

You need [Crystal](https://github.com/crystal-lang) installed in your system to get compiler features like goTo implementation and diagnostics.

Other features like _syntax highlighting_, _snippets_, _symbols_ and _basic completion_ work without Crystal compiler.

## 3. Configuration

`crystal-lang` provides some useful configuration inside `settings.json`:

```json
{
  "crystal-lang.problems": "syntax",
  "crystal-lang.maxNumberOfProblems": 10,
  "crystal-lang.mainFile": "",
  "crystal-lang.processesLimit": 3,
  "crystal-lang.implementations": true,
  "crystal-lang.completion": true,
  "crystal-lang.hover": true,
  "crystal-lang.server": "",
  "crystal-lang.logLevel": "error",
  "crystal-lang.compiler": "crystal"
}
```

> On Windows the document must use `LF` instead of `CRLF` to allow symbols completion.

### 3.1. Problems

`crystal-lang.problems` allow setting different error levels. By default, the problem finder just check syntax errors. The options are:

![problem finder](https://i.imgur.com/ukl1jyg.gif)

- **syntax**: check syntax and tokens (default).
- **build**: check requires, objects and methods without code gen (resource heavy).
- **none**: disable problem finder.

```json
{
  "crystal-lang.problems": "syntax | build | none",
}
```

Problems are checked when a crystal document is opened or saved.

Syntax checking is activated on type allowing live diagnostics.

> Features like **implementations** and **show type on hover** can find errors.

### 3.2. PoblemsLimit

`crystal-lang.maxNumberOfProblems` allow to limit the amount of problems that appears in problems view.

The default value is 20.

### 3.3. MainFile

Note: reload VSCode to apply this setting.

`crystal-lang.mainFile` says to the compiler which file should analyze.

It is useful with `"crystal-lang.problems" = "build"` in projects where a main file do `require "./**"`

Also is used by features like **implementations** and show **type on hover** to specify the tool scope.

> You should use workspaceRoot to get absolute filepath.

```json
{
  "crystal-lang.mainFile": "${workspaceRoot}/src/main.cr",
}
```

### 3.4. ProcessesLimit

Note: reload VSCode to apply this setting.

This extension block the amout of crystal processes executing in parallel to reduce resources usage.

Commonly crystal takes milliseconds to do something like formatting, but in some projects other features like implementations or completion can take a moment. To prevent using too many resources you can set the amount of processes with:

```json
{
  "crystal-lang.processesLimit": 3,
}
```

> By default, is 3. In my computer each crystal process uses almost 50 MB and less than 1 second.

### 3.5. Implementations

You can use this feature to peek or go to implementation of a method.

This extension show implementations and definitions as same thing.

![implementations](https://i.imgur.com/FDrEP7E.gif)

### 3.6. Completion

This setting ensure to enable instance method completion using crystal tool context.

Suggestion of methods and subtypes while typing is not supported. You need to type `.` (dot) or `::` (colons) and then press `CTRL + SPACE` or `CMD + SPACE` to call method suggestion.

![instance method completion](https://i.imgur.com/3Peiizd.gif)

![String methods](https://i.imgur.com/ZQZm9eU.png)

Basic code completion is available. (Top Level, Symbols and Snippets)

![subtypes completion](https://i.imgur.com/qC9UBzC.gif)

![File methods](https://i.imgur.com/THctqVu.png)

However, you can totally disable completions in `settings.json`:

```json
{
  "editor.quickSuggestions": {
    "other": true,
    "comments": false,
    "strings": false
  }
}
```

### 3.7. Hover

Show symbols information on hover.

This feature uses `crystal tool context` to get types.

![hover](https://i.imgur.com/wvZyoMf.gif)

### 3.8. Server (NEW)

It's **Experimental** feature using Scry and Language Server Protocol.

> Reload your editor after enable this feature.

[![Scry](https://i.imgur.com/ticTfT8.png)](https://github.com/kofno/scry)

The following features are implemented:

- Formatting
- Live Diagnostics
- GoTo Definition
- Peek Definition

> Scry server isn't distributed with this extension. You need to install it from [scry repo](https://github.com/kofno/scry) and configure on `settings.json`

```json
{
  "crystal-lang.server": "/absolute/path/bin/scry",
}
```

### 3.9. LogLevel

Controls the amount of data logged by Scry server.

> You can see logs in `.scry.out` located in your home directory or your workspace.

Levels avaliables:

```json
{
  "type": "string",
  "default": "error",
  "enum": [
    "debug",
    "info",
    "warn",
    "error",
    "fatal"
  ]
}
```

### 3.10. Compiler

> Note: reload VSCode to apply this setting.

Allow to set a custom absolute path for Crystal compiler executable.

```json
{
  "crystal-lang.compiler": "/usr/bin/crystal"
}
```

## 4. Messages

Sometimes in some projects, `crystal tool` turns heavy, in this case you can check error and info messages.

Errors and info messages are shown in developer tools:

- `ERROR: spawn`: when crystal program not exist in path or `mainFile` is wrong.
- `ERROR: JSON parse`: when crystal output is different of JSON.
- `INFO: processesLimit has been reached`: your project is taking too much time to analyze.

The following images show crystal status bar messages:

![crystal build](https://i.imgur.com/9nRIO5o.png)

![crystal tool context](https://i.imgur.com/xCUt9GJ.png)

![crystal tool implementations](https://i.imgur.com/7qImusH.png)

## 5. Know issues

- Linter and formatter are implemented using Node.js `child_process`, so performance could be affected.

- `macros` can produce some unwanted behaviors.

- ECR syntax doesn't have emmet support. You can use vscode `text.html` instead or enable emmet for `text.ecr` in your `settings.json`:

```json
{
  "emmet.syntaxProfiles": {
    "ecr": "html"
  }
}
```

- In some big projects like [crystal compiler](https://github.com/crystal-lang) itself, the setting `"crystal-lang.problems" = "build"` could be very unresponsive, use `"syntax"` instead.

- Scry server is experimental, some bug can appear.

## 6. More Screenshots

### 6.1. Increment and decrement identation

![identation](https://i.imgur.com/V15TxFb.gif)

> Decrement `end` keyword on type is now avaliable in vscode [1.14](https://code.visualstudio.com/updates/v1_14#_auto-indent-on-type-move-lines-and-paste).

### 6.2. Formatting code support

![formatting](https://i.imgur.com/VTeOkOm.gif)

### 6.3. Syntax highlighting

![ecr](https://i.imgur.com/w9aBlIH.gif)

### 6.4. Snippets

![snippets](https://i.imgur.com/GNICZSH.gif)

### 6.5. Symbols

![symbols](https://i.imgur.com/6cqcXD3.gif)

### 6.6. Code Outline (NEW)

Recent version of VSCode (1.13.1) allow to extensions creators show symbols in tree view. You can use the awesome [Code Outline](https://marketplace.visualstudio.com/items?itemName=patrys.vscode-code-outline) extension to see code tree of crystal document.

![code outline](https://i.imgur.com/guRDY0T.png)

### 6.7. Debugging

[Native Debug](https://marketplace.visualstudio.com/items?itemName=webfreak.debug) is an excellent extension that allow you to debug crystal and other languages that compile to binary.

> Be sure of compile your crystal code with `--debug` flag

![Native Debug extension](https://i.imgur.com/mrJzrxI.png)


### 6.8 Icon theme (NEW)

[Simple icons](https://marketplace.visualstudio.com/items?itemName=LaurentTreguier.vscode-simple-icons) theme has beautiful icons for Crystal and common languages.

![simple icons](https://i.imgur.com/oC3rzox.png)

## 7. Roadmap

- Add macro support, see issue [#4](https://github.com/faustinoaq/vscode-crystal-lang/issues/4).
- Full Support for Language Server Protocol, see [Scry](https://github.com/kofno/scry)

## 8. Release Notes

See [Changelog](https://github.com/faustinoaq/vscode-crystal-lang/blob/master/CHANGELOG.md)

## 9. Contributing

1. Fork it https://github.com/faustinoaq/vscode-crystal-lang/fork
2. Create your feature branch `git checkout -b my-new-feature`
3. Commit your changes `git commit -am 'Add some feature'`
4. Push to the branch `git push origin my-new-feature`
5. Create a new Pull Request

## 10. Contributors

- [@faustinoaq](https://github.com/faustinoaq) Faustino Aguilar - creator, maintainer
