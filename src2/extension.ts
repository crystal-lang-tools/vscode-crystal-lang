import {
  Disposable, ConfigurationChangeEvent, ExtensionContext,
  workspace, TextDocument, CancellationTokenSource
} from "vscode";
import {
  DocumentSelector, LanguageClient, LanguageClientOptions, ServerOptions
} from "vscode-languageclient/node";
import { existsSync } from "fs";

import { getProjectRoot, getConfig, outputChannel } from "./vscode";
import { registerFormatter } from "./format";
import { handleDocumentProblems } from "./problems";
import { getDocumentMainFiles } from "./compiler";
import { registerDefinitions } from "./definitions";
import { CrystalTestingProvider } from "./spec";
import { registerSymbols } from "./symbols";
import { registerCompletion, updateHierarchyCache } from "./completion";
import { registerRequireDefinitions } from "./requires";
import { registerHover } from "./hover";
import { handleDocumentUnreachable } from "./unreachable";
import { registerMacroHover } from "./macro";


let languageContext: ExtensionContext
let lspClient: LanguageClient

let disposeFormat: Disposable
let disposeSave: Disposable
let disposeDefinitions: Disposable
let disposeSpecs: CrystalTestingProvider
let disposeSymbols: Disposable
let disposeComplete: Disposable
let disposeRequire: Disposable
let disposeHover: Disposable
let disposeMacroHover: Disposable

let compilerCancellationToken: CancellationTokenSource = new CancellationTokenSource();

export const wordPattern = /(?:-?(?:0(?:b|o|x))?\d+(?:\.\d+)?(?:_?[iuf]\d+)?)|@{0,2}(?:(?:(?<!:):)?[A-Za-z][^-`~@#%^&()=+[{}|;:'\",<>\/.*\]\s\\!?]*[!?]?)/
export const constPattern = /(?::{1,2})?(?:[A-Z][a-zA-Z0-9]*(?:::))*(?:[A-Z][a-zA-Z0-9]*(?:\([A-Z][a-zA-Z0-9]*(?:, +[A-Z][a-zA-Z0-9]*)*?\))?|:{1,2})(?::{1,2})?/


const selector: DocumentSelector = [
  { language: 'crystal', scheme: 'file' },
  { language: 'ecr', scheme: 'file' }
];


export async function activate(context: ExtensionContext): Promise<void> {
  outputChannel.appendLine("[Crystal] Loading extension...")
  languageContext = context

  const config = getConfig();
  const lspExecutable = config.get<string>("server");
  const lspEnv = config.get<object>("server-env");

  workspace.onDidChangeConfiguration((e) => handleConfigChange(e))

  // TODO: search path for lspExecutable
  if (existsSync(lspExecutable)) {
    activateLanguageServer(lspExecutable, lspEnv);
  } else {
    if (!(lspExecutable.length == 0)) {
      outputChannel.appendLine(`[Crystal] Failed to find LSP executable at ${lspExecutable}, falling back to default behavior`)
    }

    activateLanguageFeatures(context);
  }

  activateSpecExplorer();
}

export function deactivate() {
  if (lspClient === undefined) {
    return
  }

  return lspClient.stop()
}

function activateLanguageServer(executable: string, env: object) {
  if (lspClient !== undefined) {
    lspClient.stop()
    lspClient = undefined
  }

  outputChannel.appendLine(`[Crystal] Loading LSP from ${executable}`)

  let serverOptions: ServerOptions = { command: executable, args: [] }

  if (env) {
    serverOptions.options = { env: { ...process.env, ...env } }
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: selector,
    synchronize: {
      configurationSection: "crystal-lang",
      fileEvents: workspace.createFileSystemWatcher("**/*.cr")
    },
    outputChannel: outputChannel
  }

  lspClient = new LanguageClient("Crystal Language", serverOptions, clientOptions)

  lspClient.start()
}

function deactivateLanguageServer() {
  outputChannel.appendLine("[Crystal] Deactivating LSP")

  if (lspClient) {
    lspClient.stop()
    lspClient = undefined
  }
}


function activateLanguageFeatures(context: ExtensionContext) {
  outputChannel.appendLine("[Crystal] Activating built-in language features")

  if (disposeFormat === undefined) {
    disposeFormat = registerFormatter(selector, context)
  }

  if (disposeSave === undefined) {
    disposeSave = workspace.onDidSaveTextDocument((e) => handleSaveDocument(e))
  }

  if (disposeDefinitions === undefined) {
    disposeDefinitions = registerDefinitions(selector, context)
  }

  if (disposeSymbols === undefined) {
    disposeSymbols = registerSymbols(selector, context)
  }

  if (disposeComplete === undefined) {
    disposeComplete = registerCompletion(selector, context)
  }

  if (disposeRequire === undefined) {
    disposeRequire = registerRequireDefinitions(selector, context)
  }

  if (disposeHover === undefined) {
    disposeHover = registerHover(selector, context)
  }

  if (disposeMacroHover === undefined) {
    disposeMacroHover = registerMacroHover(selector, context)
  }
}

function activateSpecExplorer() {
  outputChannel.appendLine("[Crystal] Activating spec explorer")
  const config = getConfig();

  if (disposeSpecs === undefined && config.get<boolean>("spec-explorer")) {
    disposeSpecs = new CrystalTestingProvider();
  }
}

function deactivateLanguageFeatures() {
  outputChannel.appendLine("[Crystal] Deactivating built-in language features")

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

  if (disposeComplete) {
    disposeComplete.dispose()
    disposeComplete = undefined
  }

  if (disposeRequire) {
    disposeRequire.dispose()
    disposeRequire = undefined
  }

  if (disposeHover) {
    disposeHover.dispose()
    disposeHover = undefined
  }

  if (disposeMacroHover) {
    disposeMacroHover.dispose()
    disposeMacroHover = undefined
  }

  deactivateSpecExplorer();
}

function deactivateSpecExplorer() {
  outputChannel.appendLine("[Crystal] Deactivating spec explorer")

  if (disposeSpecs) {
    disposeSpecs.controller.dispose();
    disposeSpecs = undefined;
  }
}


async function handleConfigChange(e: ConfigurationChangeEvent) {
  const config = getConfig();

  // Check if LSP config changed and auto-stop/start LSP
  if (e.affectsConfiguration("crystal-lang.server") || e.affectsConfiguration("crystal-lang.server-env")) {
    const lspExecutable = config.get<string>("server");
    const lspEnv = config.get<object>("server-env");

    if (lspClient === undefined || !lspClient.isRunning) {
      if (existsSync(lspExecutable)) {
        deactivateLanguageFeatures()
        activateLanguageServer(lspExecutable, lspEnv)
      } else {
        outputChannel.appendLine(`[Crystal] Failed to find LSP executable at ${lspExecutable}, falling back to default behavior`)
        deactivateLanguageServer()
        activateLanguageFeatures(languageContext)
      }
    } else {
      if (lspExecutable === undefined || lspExecutable.length == 0) {
        deactivateLanguageServer()
        activateLanguageFeatures(languageContext)
      } else {
        outputChannel.appendLine(`[Crystal] Restarting LSP`)
        deactivateLanguageServer()
        activateLanguageServer(lspExecutable, lspEnv)
      }
    }
  }

  if (e.affectsConfiguration("crystal-lang.spec-explorer")) {
    const specExplorer = config.get<boolean>("spec-explorer")

    if (disposeSpecs === undefined) {
      if (specExplorer) {
        activateSpecExplorer();
      }
    } else {
      if (!specExplorer) {
        deactivateSpecExplorer();
      }
    }
  }
}

async function handleSaveDocument(e: TextDocument): Promise<void> {
  if (e.uri.scheme !== "file" || !(e.fileName.endsWith(".cr") || e.fileName.endsWith(".ecr")))
    return;

  compilerCancellationToken.cancel()
  compilerCancellationToken = new CancellationTokenSource();
  const token = compilerCancellationToken.token;

  const config = getConfig();
  const mainFiles = await getDocumentMainFiles(e);
  const projectRoot = getProjectRoot(e.uri);

  if (config.get<boolean>("problems")) {
    await handleDocumentProblems(e, mainFiles, projectRoot, token);
  }

  if (config.get<boolean>("spec-explorer")) {
    await disposeSpecs.handleDocumentSpecs(e, token)
  }

  if (config.get<boolean>("unreachable")) {
    await handleDocumentUnreachable(e, token);
  }

  if (config.get<boolean>("hierarchy-complete")) {
    await updateHierarchyCache(e, token);
  }
}
