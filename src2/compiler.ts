import {
  Diagnostic, DiagnosticCollection, DiagnosticSeverity,
  Range, TextDocument, Uri, WorkspaceFolder,
  languages, workspace
} from "vscode";
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { cwd } from "process";
import path = require("path");
import * as yaml from 'yaml';
import glob = require("glob");

import { execAsync } from "./tools";
import { getProjectRoot, getConfig, outputChannel, getFlags } from "./vscode";
import { spawnProblemsTool } from "./problems";


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
  const config = getConfig();

  if (config.has('compiler')) {
    const exe = config.get<string>('compiler');
    if (path.isAbsolute(exe) && existsSync(exe)) return Promise.resolve(exe);
  }

  const command =
    (process.platform === 'win32' ? 'where' : 'which') + ' crystal';

  return execSync(command).toString().trim();
}

export async function getDocumentMainFiles(document: TextDocument): Promise<string[]> {
  const config = getConfig();
  const projectRoot = getProjectRoot(document.uri);

  // Specs are their own main files
  if (document.fileName.endsWith('_spec.cr')) {
    return [document.fileName];
  }

  // Use main if provided and it exists
  if (config.get<string>("main")) {
    const mainFile = config.get<string>("main").replace(
      "${workspaceRoot}", projectRoot.uri.fsPath
    )
    if (existsSync(mainFile)) return [mainFile];

    if (mainFile.includes('*')) {
      const globbed = glob.sync(mainFile)

      if (globbed?.length > 0) return globbed;
    }

    outputChannel.appendLine(`[Crystal] Main file ${mainFile} doesn't exist, using fallbacks`)
  }

  if (config.get<boolean>("dependencies")) {
    const shardTarget = await getDocumentShardTarget(document);
    if (shardTarget.response) return [shardTarget.response];
    if (shardTarget.error) return;
  }

  const shardYmlPath = path.join(projectRoot.uri.fsPath, "shard.yml")
  if (existsSync(shardYmlPath)) {
    const shardYml = readFileSync(shardYmlPath, 'utf-8');
    const shard = yaml.parse(shardYml) as Shard

    // Use a target with the shard name
    var main = shard.targets?.[shard.name]?.main;
    if (main && existsSync(path.resolve(projectRoot.uri.fsPath, main)))
      return [path.resolve(projectRoot.uri.fsPath, main)];

    if (shard.targets) {
      // Use the first target if it exists
      main = Object.values(shard.targets)[0]?.main;
      if (main && existsSync(path.resolve(projectRoot.uri.fsPath, main)))
        return [path.resolve(projectRoot.uri.fsPath, main)];
    }

    // Splat all top-level files in source folder,
    // only if the file is in the /src or /lib directories
    if (document.uri.fsPath.includes(path.join(projectRoot.uri.fsPath, 'src')) ||
      document.uri.fsPath.includes(path.join(projectRoot.uri.fsPath, 'lib'))) {
      const globbed = glob.sync(path.join(projectRoot.uri.fsPath, 'src', '*.cr'))

      if (globbed?.length > 0) return globbed;
    }
  }

  // single independent file (like a script)
  return [document.fileName];
}

async function getDocumentShardTarget(document: TextDocument): Promise<{ response: string, error }> {
  const cmd = await getCompilerPath();
  const projectRoot = getProjectRoot(document.uri);
  const config = getConfig();

  const targets = getShardYmlTargets(projectRoot);

  if (!targets) return;

  for (const target of targets) {
    const targetPath = path.resolve(projectRoot.uri.fsPath, target);
    if (!existsSync(targetPath)) continue;

    const args = [
      'tool', 'dependencies', targetPath,
      '-f', 'flat', '--no-color',
      ...getFlags(config)
    ]

    outputChannel.appendLine(`[Dependencies] (${projectRoot.name}) $ ${cmd} ${args.join(' ')}`)

    const targetDocument = await workspace.openTextDocument(Uri.parse(targetPath))

    const result = await execAsync(cmd, args, { cwd: projectRoot.uri.fsPath })
      .then((resp) => {
        return { response: resp, error: false }
      })
      .catch((err) => {
        spawnProblemsTool(targetDocument, [target], projectRoot);
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
  const cmd = await getCompilerPath();
  const response = await execAsync(cmd, ['--version'], { cwd: cwd() })

  const match = response.stdout.match(/Crystal (\d+)\.(\d+)\.(\d+)/)

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}

const CRYSTAL_PATH = process.env.CRYSTAL_PATH || '';

async function getCrystalEnv(): Promise<{ [key: string]: string; }> {
  const compiler = await getCompilerPath();
  const output = (await execAsync(compiler, ['env'])).stdout
  const lines = output.split(/\r?\n/)
  const env: { [key: string]: string } = {}

  lines.forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
    }
  })

  return env;
}

export async function getPathToLibrary(
  library: string, project: WorkspaceFolder
): Promise<string> {
  try {
    const crystalPath = (await getCrystalEnv()).CRYSTAL_PATH;
    if (!crystalPath) return;

    if (!library.endsWith(".cr"))
      library += ".cr";

    for (let dir of crystalPath.split(":")) {
      if (!path.isAbsolute(dir))
        dir = path.join(project.uri.fsPath, dir)

      const libraryPath = path.join(dir, library)
      if (existsSync(libraryPath)) {
        return libraryPath;
      }

      // Special handling for 'lib'
      const items = glob.sync(`./*/src/${library}`, { cwd: dir })
      if (items[0]) {
        return path.join(dir, items[0])
      }
    }
  } catch (err) {
    outputChannel.appendLine(JSON.stringify(err))
  }

  return;
}

export async function getListOfLibraries(uri: Uri): Promise<string[]> {
  const crystalEnv = (await getCrystalEnv()).CRYSTAL_PATH;

  if (!crystalEnv) return [];

  const libraries: string[] = []

  const paths = crystalEnv.split(":")
  paths.forEach(async (p: string) => {
    try {
      // Need to handle the lib folder special
      let libPath = false;
      if (p === "lib") libPath = true;

      if (!path.isAbsolute(p))
        p = path.join(uri.fsPath, p)

      if (!existsSync(p)) return;

      let globString = "./**/*.cr"
      if (libPath) globString = "./*/src/**/*.cr"

      let items = glob.sync(globString, { cwd: p })

      for (const item of items) {
        let parsedItem = item;

        if (libPath) {
          parsedItem = item.replace(/^[^\/\\]*[\/\\]src[\/\\]/, '')
        }

        parsedItem = parsedItem.replace('.cr', '')

        libraries.push(parsedItem);
      }
    } catch (err) {
      outputChannel.appendLine(JSON.stringify(err))
    }
  })

  return libraries;
}
