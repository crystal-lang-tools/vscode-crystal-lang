import { Disposable, ConfigurationChangeEvent, DocumentFormattingEditProvider, ExtensionContext, workspace } from "vscode";
import { DocumentSelector, LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import { existsSync } from "fs";

import { outputChannel } from "./vscode";
import { registerFormatter } from "./format";


let languageContext: ExtensionContext
let lspClient: LanguageClient
let disposeFormat: Disposable

const selector: DocumentSelector = [
  { language: 'crystal', scheme: 'file' },
  { language: 'ecr', scheme: 'file' }
];


export async function activate(context: ExtensionContext): Promise<void> {
  outputChannel.appendLine("[Crystal] Loading extension...")
  languageContext = context

  const config = workspace.getConfiguration("crystal-lang");
  const lspExecutable = config.get<string>("server");

  workspace.onDidChangeConfiguration((e) => handleConfigChange(e))

  // TODO: search path for lspExecutable
  if (existsSync(lspExecutable)) {
    activateLanguageServer(lspExecutable);
  } else {
    if (!(lspExecutable.length == 0)) {
      outputChannel.appendLine(`[Crystal] Failed to find LSP executable at ${lspExecutable}, falling back to default behavior`)
    }

    activateLanguageFeatures(context)
  }
}

export function deactivate() {
  deactivateLanguageServer()
  deactivateLanguageFeatures()
}


async function activateLanguageServer(executable: string) {
  if (lspClient === undefined) {
    outputChannel.appendLine(`[Crystal] Loading LSP from ${executable}`)

    let serverOptions: ServerOptions = { command: executable, args: [] }
    let clientOptions: LanguageClientOptions = {
      documentSelector: selector,
      synchronize: {
        configurationSection: "crystal-lang",
        fileEvents: workspace.createFileSystemWatcher("**/*.cr")
      },
      outputChannel: outputChannel
    }

    lspClient = new LanguageClient("Crystal Language", serverOptions, clientOptions)
  }

  lspClient.start()
}

async function deactivateLanguageServer() {
  outputChannel.appendLine("[Crystal] Deactivating LSP")

  if (lspClient) {
    lspClient.stop()
  }
}


async function activateLanguageFeatures(context: ExtensionContext) {
  const config = workspace.getConfiguration("crystal-lang");

  if (disposeFormat === undefined) {
    disposeFormat = registerFormatter(selector, context)
  }
}

async function deactivateLanguageFeatures() {
  if (disposeFormat) {
    disposeFormat.dispose()
    disposeFormat = undefined
  }
}


async function handleConfigChange(e: ConfigurationChangeEvent) {
  const config = workspace.getConfiguration("crystal-lang");

  // Check if LSP config changed and auto-stop/start LSP
  if (e.affectsConfiguration("crystal-lang.server")) {
    const lspExecutable = config.get<string>("server");

    if (lspClient === undefined || !lspClient.isRunning) {
      if (existsSync(lspExecutable)) {
        deactivateLanguageFeatures()
        activateLanguageServer(lspExecutable)
      } else {
        outputChannel.appendLine(`[Crystal] Failed to find LSP executable at ${lspExecutable}, falling back to default behavior`)
      }
    } else {
      if (lspExecutable === undefined || lspExecutable.length == 0) {
        deactivateLanguageServer()
        activateLanguageFeatures(languageContext)
      } else {
        outputChannel.appendLine(`[Crystal] Restarting LSP`)
        deactivateLanguageServer()
        activateLanguageServer(lspExecutable)
      }
    }
  }
}
