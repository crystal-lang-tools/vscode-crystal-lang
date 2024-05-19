import { Disposable, ConfigurationChangeEvent, DocumentFormattingEditProvider, ExtensionContext, workspace, TextDocument } from "vscode";
import { DocumentSelector, LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import { existsSync } from "fs";
import { E_CANCELED } from "async-mutex";

import { getProjectRoot, outputChannel } from "./vscode";
import { registerFormatter } from "./format";
import { handleDocumentProblems } from "./problems";
import { compilerMutex, getDocumentMainFile } from "./compiler";


let languageContext: ExtensionContext
let lspClient: LanguageClient

let disposeFormat: Disposable
let disposeSave: Disposable

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

  if (disposeSave === undefined) {
    disposeSave = workspace.onDidSaveTextDocument((e) => handleSaveDocument(e))
  }
}

async function deactivateLanguageFeatures() {
  if (disposeFormat) {
    disposeFormat.dispose()
    disposeFormat = undefined
  }

  if (disposeSave) {
    disposeSave.dispose()
    disposeSave = undefined
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

async function handleSaveDocument(e: TextDocument): Promise<void> {
  compilerMutex.cancel()
  compilerMutex.acquire()
    .then(async (release) => {
      try {
        const config = workspace.getConfiguration("crystal-lang");
        const mainFile = await getDocumentMainFile(e);
        const projectRoot = getProjectRoot(e.uri);

        if (config.get<boolean>("problems")) {
          await handleDocumentProblems(e, mainFile, projectRoot)
        }
      } finally {
        release()
      }
    })
    .catch(e => {
      if (e === E_CANCELED) return;
      throw e;
    });
}
