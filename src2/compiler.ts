import { existsSync, readFileSync } from "fs";
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, TextDocument, Uri, WorkspaceFolder, languages, workspace } from "vscode";
import { Mutex } from "async-mutex";
import { cwd } from "process";
import path = require("path");
import * as yaml from 'yaml';

import { execAsync, shellEscape } from "./tools";
import { getProjectRoot, get_config, outputChannel } from "./vscode";
import { spawnProblemsTool } from "./problems";


export const compilerMutex = new Mutex();
export const diagnosticCollection: DiagnosticCollection = languages.createDiagnosticCollection("crystal")


/**
 * Format for an individual dependency in a `shard.yml`.
 *
 * @interface Dependency
 */
interface Dependency {
  git?: string;
  github?: string;
  gitlab: string;
  branch?: string;
  version?: string;
}

/**
 * Format of a `shard.yml` file.
 *
 * @interface Shard
 */
interface Shard {
  name: string;
  description?: string;
  version: string;
  crystal?: string;
  repository?: string;
  authors?: string[];
  dependencies?: Record<string, Dependency>;
  targets?: Record<string, Record<string, string>>;
  license?: string;
}

export async function getCompilerPath(): Promise<string> {
  const config = get_config();

  if (config.has('compiler')) {
    const exe = config.get<string>('compiler');
    if (path.isAbsolute(exe) && existsSync(exe)) return Promise.resolve(exe);
  }

  const command =
    (process.platform === 'win32' ? 'where' : 'which') + ' crystal';

  return (await execAsync(command, process.cwd())).stdout.trim();
}

export async function getDocumentMainFile(document: TextDocument): Promise<string> {
  const config = get_config();
  const projectRoot = getProjectRoot(document.uri);

  // Specs are their own main files
  if (document.fileName.endsWith('_spec.cr')) {
    return document.fileName;
  }

  // Use main if provided and it exists
  if (config.get<string>("main")) {
    const mainFile = config.get<string>("main").replace(
      "${workspaceRoot}", projectRoot.uri.fsPath
    )
    if (mainFile.includes('*') || existsSync(mainFile)) return mainFile;
    outputChannel.appendLine(`[Crystal] Main file ${mainFile} doesn't exist, using fallbacks`)
  }

  if (config.get<boolean>("dependencies")) {
    const shardTarget = await getDocumentShardTarget(document);
    if (shardTarget.response) return shardTarget.response;
    if (shardTarget.error) return;
  }

  const shardYmlPath = path.join(projectRoot.uri.fsPath, "shard.yml")
  if (existsSync(shardYmlPath)) {
    const shardYml = readFileSync(shardYmlPath, 'utf-8');
    const shard = yaml.parse(shardYml) as Shard

    // Use a target with the shard name
    var main = shard.targets?.[shard.name]?.main;
    if (main && existsSync(path.resolve(projectRoot.uri.fsPath, main)))
      return path.resolve(projectRoot.uri.fsPath, main);

    if (shard.targets) {
      // Use the first target if it exists
      main = Object.values(shard.targets)[0]?.main;
      if (main && existsSync(path.resolve(projectRoot.uri.fsPath, main)))
        return path.resolve(projectRoot.uri.fsPath, main);
    }

    // Splat all top-level files in source folder,
    // only if the file is in the /src or /lib directories
    if (document.uri.fsPath.includes(path.join(projectRoot.uri.fsPath, 'src')) ||
      document.uri.fsPath.includes(path.join(projectRoot.uri.fsPath, 'lib'))) {
      return path.join(projectRoot.uri.fsPath, 'src', '*.cr')
    }
  }

  // single independent file (like a script)
  return document.fileName;
}

async function getDocumentShardTarget(document: TextDocument): Promise<{ response: string, error }> {
  const compiler = await getCompilerPath();
  const projectRoot = getProjectRoot(document.uri);
  const config = get_config();


  const targets = getShardYmlTargets(projectRoot);

  if (!targets) return;

  for (const target of targets) {
    const targetPath = path.resolve(projectRoot.uri.fsPath, target);
    if (!existsSync(targetPath)) continue;

    const cmd = `${shellEscape(compiler)} tool dependencies ${shellEscape(targetPath)} -f flat --no-color ${config.get<string>("flags")}`
    outputChannel.appendLine(`[Dependencies] (${projectRoot.name}) $ ${cmd}`)

    const targetDocument = await workspace.openTextDocument(Uri.parse(targetPath))

    const result = await execAsync(cmd, projectRoot.uri.fsPath)
      .then((resp) => {
        return { response: resp, error: false }
      })
      .catch((err) => {
        spawnProblemsTool(targetDocument, target, projectRoot);
        return { response: undefined, error: err }
      })

    if (result.error) return result.response.stderr;
    if (result.response.stdout.trim.size === 0) continue;
    const dependencies = result.response.stdout.split(/\r?\n/)

    for (const line of dependencies) {
      const linePath = path.resolve(projectRoot.uri.fsPath, line.trim())
      if (linePath === document.uri.fsPath) {
        return { response: targetPath, error: false }
      }
    }
  }

  return { response: undefined, error: false };
}

/**
 * Gets the paths to each target in the `shard.yml` of a workspace.
 *
 * @param {WorkspaceFolder} space
 * @return {*}  {string[]}
 */
function getShardYmlTargets(space: WorkspaceFolder): string[] {
  const shardFile = path.join(space.uri.fsPath, 'shard.yml')

  if (existsSync(shardFile)) {
    const io = readFileSync(shardFile, 'utf8')
    const data = yaml.parse(io)

    if (data.targets !== undefined) {
      const values = Object.keys(data.targets).map(key => data.targets[key])
      return values.map(v => v.main)
    }
  }

  return []
}


interface ErrorResponse {
  file: string
  line: number | null
  column: number | null
  size: number | null
  message: string
}

export async function findProblems(response: string, uri: Uri): Promise<void> {
  const projectRoot = getProjectRoot(uri);

  let parsedResponses: ErrorResponse[];
  try {
    parsedResponses = JSON.parse(response)
  } catch {
    return findProblemsRaw(response, uri);
  }

  let diagnostics = []
  if (!JSON.parse(response).status) {
    let lastIdx = -1

    for (let i = 0; i < parsedResponses.length; i++) {
      const response = parsedResponses[i];
      let uri = Uri.file(response.file)

      if (uri.fsPath.startsWith(projectRoot.uri.fsPath)) {
        lastIdx = i
      }
    }

    if (lastIdx === -1) {
      lastIdx = 0
    }

    for (let i = lastIdx; i < parsedResponses.length; i++) {
      const resp = parsedResponses[i];

      if (resp.line == null)
        resp.line = 1
      if (resp.column == null)
        resp.column = 1
      if (resp.size == null)
        resp.size = 0
      const range = new Range(resp.line - 1, resp.column - 1, resp.line - 1, (resp.column + resp.size) - 1)
      const diagnostic = new Diagnostic(range, resp.message, DiagnosticSeverity.Error)
      var diag_uri = Uri.file(resp.file)
      if (!path.isAbsolute(resp.file)) {
        diag_uri = Uri.file(path.resolve(projectRoot.uri.fsPath, resp.file))
      }

      diagnostics.push([diag_uri, [diagnostic]])
    }
  }

  diagnosticCollection.clear()

  if (diagnostics.length > 0) {
    diagnosticCollection.set(diagnostics)
  }
}

export async function findProblemsRaw(response: string, uri: Uri): Promise<void> {
  if (!response) return;

  const projectRoot = getProjectRoot(uri);
  const responseData = response.match(/(?:.*)in '?(.*):(\d+):(\d+)'?:?([^]*)$/mi)

  let parsedLine = 0
  try {
    parsedLine = parseInt(responseData[2])
  } catch {
    diagnosticCollection.delete(uri)
    return;
  }

  let errorPath: string = path.join(uri.fsPath, responseData[1])
  if (!existsSync(errorPath)) {
    errorPath = uri.fsPath
  }

  let diagnostics = []
  if (parsedLine !== 0) {
    const resp: ErrorResponse = {
      file: errorPath,
      line: parseInt(responseData[2]),
      column: parseInt(responseData[3]),
      size: null,
      message: responseData[4].trim()
    }

    const range = new Range(resp.line - 1, resp.column - 1, resp.line - 1, resp.column - 1)
    const diagnostic = new Diagnostic(range, resp.message, DiagnosticSeverity.Error)
    var diag_uri = Uri.file(resp.file)
    if (!path.isAbsolute(resp.file)) {
      diag_uri = Uri.file(path.resolve(projectRoot.uri.fsPath, resp.file))
    }

    diagnostics.push([diag_uri, [diagnostic]])
  }

  if (diagnostics.length == 0) {
    diagnosticCollection.clear()
  } else {
    diagnosticCollection.set(diagnostics)
  }
}

/**
 * Semantic version of Crystal
 *
 * @export
 * @interface SemVer
 */
export interface SemVer {
  major: number,
  minor: number,
  patch: number
}

/**
 * Gets the version of the Crystal compiler.
 *
 * @export
 * @return {*}  {Promise<SemVer>}
 */
export async function getCrystalVersion(): Promise<SemVer> {
  const compiler = await getCompilerPath();
  const cmd = `${shellEscape(compiler)} --version`
  const response = await execAsync(cmd, cwd())

  const match = response.stdout.match(/Crystal (\d+)\.(\d+)\.(\d+)/)

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}
