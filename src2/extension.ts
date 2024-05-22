import { Disposable, ConfigurationChangeEvent, ExtensionContext, workspace, TextDocument } from "vscode";
import { DocumentSelector, LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import { existsSync } from "fs";
import { E_CANCELED } from "async-mutex";

import { getProjectRoot, getConfig, outputChannel } from "./vscode";
import { registerFormatter } from "./format";
import { handleDocumentProblems } from "./problems";
import { compilerMutex, getDocumentMainFile } from "./compiler";
import { registerDefinitions } from "./definitions";
import { CrystalTestingProvider } from "./spec";
import { registerSymbols } from "./symbols";


let languageContext: ExtensionContext
let lspClient: LanguageClient

let disposeFormat: Disposable
let disposeSave: Disposable
let disposeDefinitions: Disposable
let disposeSpecs: CrystalTestingProvider
let disposeSymbols: Disposable

const selector: DocumentSelector = [
  { language: 'crystal', scheme: 'file' },
  { language: 'ecr', scheme: 'file' }
];


export async function activate(context: ExtensionContext): Promise<void> {
  outputChannel.appendLine("[Crystal] Loading extension...")
  languageContext = context

  const config = getConfig();
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
  const config = getConfig();

  if (disposeFormat === undefined) {
    disposeFormat = registerFormatter(selector, context)
  }

  if (disposeSave === undefined) {
    disposeSave = workspace.onDidSaveTextDocument((e) => handleSaveDocument(e))
    disposeDefinitions = registerDefinitions(selector, context)
  }

  if (disposeSymbols === undefined) {
    disposeSymbols = registerSymbols(selector, context)
  }

  activateSpecExplorer();
}

function activateSpecExplorer() {
  const config = getConfig();

  if (disposeSpecs === undefined && config.get<boolean>("spec-explorer")) {
    disposeSpecs = new CrystalTestingProvider();
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

  if (disposeDefinitions) {
    disposeDefinitions.dispose()
    disposeDefinitions = undefined
  }

  if (disposeSymbols) {
    disposeSymbols.dispose()
    disposeSymbols = undefined
  }

  deactivateSpecExplorer();
}

function deactivateSpecExplorer() {
  if (disposeSpecs) {
    disposeSpecs.controller.dispose();
    disposeSpecs = undefined;
  }
}


async function handleConfigChange(e: ConfigurationChangeEvent) {
  const config = getConfig();

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

  if (e.affectsConfiguration("crystal-lang.spec-explorer")) {
    const specExplorer = config.get<boolean>("spec-explorer")

    if (disposeSpecs === undefined) {
      if (specExplorer) {
        outputChannel.appendLine(`[Crystal] Activating spec explorer`)
        activateSpecExplorer();
      }
    } else {
      if (!specExplorer) {
        outputChannel.appendLine(`[Crystal] Deactivating spec explorer`)
        deactivateSpecExplorer();
      }
    }
  }
}

async function handleSaveDocument(e: TextDocument): Promise<void> {
  if (e.uri.scheme !== "file" || !(e.fileName.endsWith(".cr") || e.fileName.endsWith(".ecr")))
    return;

  compilerMutex.cancel()
  compilerMutex.acquire()
    .then(async (release) => {
      try {
        const config = getConfig();
        const mainFile = await getDocumentMainFile(e);
        const projectRoot = getProjectRoot(e.uri);

        if (config.get<boolean>("problems")) {
          await handleDocumentProblems(e, mainFile, projectRoot)
        }

        if (config.get<boolean>("spec-explorer")) {
          await disposeSpecs.handleDocumentSpecs(e)
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
