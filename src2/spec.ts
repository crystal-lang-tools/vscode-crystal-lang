import { CancellationToken, Position, Range, TestItem, TestMessage, TestRun, TestRunProfileKind, TestRunRequest, TextDocument, Uri, WorkspaceFolder, tests, workspace } from "vscode";
import { Mutex } from "async-mutex";
import { existsSync, readFile } from "fs";
import * as junit2json from 'junit2json';
import temp = require("temp");
import path = require("path");
import glob = require("glob");

import { getProjectRoot, get_config, outputChannel, setStatusBar } from "./vscode";
import { findProblems, getCompilerPath, getCrystalVersion } from "./compiler";
import { execAsync, shellEscape } from "./tools";


const specRunnerMutex = new Mutex();


export class CrystalTestingProvider {
  private projectFolders: WorkspaceFolder[]

  controller = tests.createTestController(
    'crystalSpecs',
    'Crystal Specs'
  )

  constructor() {
    this.refreshProjectFolders()
    this.refreshTestCases()

    workspace.onDidChangeWorkspaceFolders((event) => {
      this.refreshProjectFolders()
      for (var i = 0; i < event.added.length; i += 1) {
        outputChannel.appendLine("Adding folder to workspace: " + event.added[i].uri.fsPath)
        this.getProjectTestItems(event.added[i])
      }
      event.removed.forEach((folder) => {
        outputChannel.appendLine("Removing folder from workspace: " + folder.uri.fsPath)
        this.deleteProjectTestItems(folder)
      })
    });

    this.controller.refreshHandler = async () => {
      this.refreshProjectFolders()
      this.controller.items.forEach((item) => {
        this.controller.items.delete(item.id)
      })
      this.refreshTestCases()
    }
  }

  async refreshTestCases(): Promise<void> {
    return new Promise(async () => {
      for (var i = 0; i < this.projectFolders.length; i++) {
        await this.getProjectTestItems(this.projectFolders[i])
      }
    })
  }

  runProfile = this.controller.createRunProfile('Run', TestRunProfileKind.Run,
    async (request, token) => {

      if (specRunnerMutex.isLocked()) return;

      const release = await specRunnerMutex.acquire();
      const run = this.controller.createTestRun(request);
      const start = Date.now()

      try {
        let runnerArgs = []
        this.controller.items.forEach((item) => {
          let generated = this.generateRunnerArgs(item, request.include, request.exclude)
          if (generated.length > 0 && !(runnerArgs.includes(generated))) {
            runnerArgs = runnerArgs.concat(generated)
          }
        })

        let workspaces: WorkspaceFolder[] = []
        runnerArgs.forEach((arg) => {
          const uri = Uri.file(arg)
          const space = getProjectRoot(uri)
          if (space !== undefined && !workspaces.map(w => w.uri.fsPath).includes(space.uri.fsPath)) {
            workspaces.push(space)
          }
        })

        if (token?.isCancellationRequested) {
          return;
        }

        for (let workspace of workspaces) {
          let args = []

          for (let arg of runnerArgs) {
            const argProjectRoot = getProjectRoot(Uri.file(arg))
            if (workspace.uri.fsPath == argProjectRoot.uri.fsPath && !(args.includes(arg))) {
              args.push(arg)
            }
          }

          await this.execTestCases(workspace, args, token)
            .then(result => {
              if (result) this.parseTestCaseResults(result, request, run);
            })
            .catch(err => {
              outputChannel.appendLine(`[Spec] (${workspace.name}) Error: ` + err.message)
              run.end()
            });

          if (token?.isCancellationRequested) {
            return;
          }
        }
      } finally {
        release()
        outputChannel.appendLine(`[Spec] Finished execution in ${Date.now() - start} ms`)
        run.end();
      }
    })

  refreshProjectFolders() {
    let folders: WorkspaceFolder[] = []

    workspace.workspaceFolders.forEach((folder) => {
      const list = glob.sync("**/shard.yml", { cwd: folder.uri.fsPath, ignore: 'lib/**' })

      list.forEach((item) => {
        const itemPath = path.dirname(path.resolve(folder.uri.fsPath, item));

        if (itemPath.includes(path.sep + "lib" + path.sep)) return;
        if (!existsSync(path.join(itemPath, "spec"))) return;

        folders.push({
          name: path.basename(itemPath),
          uri: Uri.file(itemPath),
          index: null
        })
      })
    })

    this.projectFolders = folders
  }

  async handleDocumentSpecs(e: TextDocument) {
    if (e.uri.scheme === "file" && this.isSpecFile(e.uri.fsPath)) {
      this.deleteTestItem(e.uri.fsPath);
      this.getProjectTestItems(getProjectRoot(e.uri), [e.uri.fsPath])
    }
  }

  isSpecFile(file: string): boolean {
    const projectRoot = getProjectRoot(Uri.file(file))
    return file.endsWith('_spec.cr') &&
      this.projectFolders.map((f) => { return f.uri.fsPath; }).includes(projectRoot.uri.fsPath)
  }

  findTestItem(id: string, parent: TestItem): TestItem | null {
    let foundChild = parent.children.get(id)
    if (foundChild) {
      return foundChild
    }
    parent.children.forEach((child) => {
      if (foundChild === undefined) {
        foundChild = this.findTestItem(id, child)
      }
    })
    return foundChild
  }

  async getProjectTestItems(workspace: WorkspaceFolder, paths?: string[]): Promise<void> {
    if (specRunnerMutex.isLocked()) {
      return;
    }

    outputChannel.appendLine(`[Spec] (${workspace.name}) Getting test items...`)

    const release = await specRunnerMutex.acquire();
    const dispose = setStatusBar('searching for specs...');

    await spawnSpecTool(workspace, true, paths)
      .then((junit) => {
        if (junit) this.convertJunitTestcases(junit)
        outputChannel.appendLine(`[Spec] (${workspace.name}) Success.`)
      }).finally(() => {
        release()
        dispose()
      })
  }

  generateRunnerArgs(item: TestItem, includes: readonly TestItem[], excludes: readonly TestItem[]): string[] {
    if (includes) {
      if (includes.includes(item)) {
        return [item.uri.fsPath]
      } else {
        let foundChildren = []
        item.children.forEach((child) => {
          foundChildren = foundChildren.concat(this.generateRunnerArgs(child, includes, excludes))
        })
        return foundChildren
      }
    } else if (excludes.length > 0) {
      if (excludes.includes(item)) {
        return []
      } else {
        let foundChildren = []
        item.children.forEach((child) => {
          foundChildren = foundChildren.concat(this.generateRunnerArgs(child, includes, excludes))
        })
        return foundChildren
      }
    } else {
      return [item.uri.fsPath]
    }
  }

  async execTestCases(workspace: WorkspaceFolder, paths?: string[], token: CancellationToken = null): Promise<junit2json.TestSuite | void> {
    outputChannel.appendLine(`[Spec] (${workspace.name}) Executing specs...`)

    return spawnSpecTool(workspace, false, paths, token)
  }

  private parseTestCaseResults(result: TestSuite, request: TestRunRequest, run: TestRun) {
    result.testcase.forEach((testcase: TestCase) => {
      let exists: TestItem = undefined;
      this.controller.items.forEach((child: TestItem) => {
        if (exists === undefined) {
          exists = this.findTestItem(testcase.file + " " + testcase.name, child);
        }
      });

      if (exists) {
        if (!(request.include && request.include.includes(exists)) || !(request.exclude?.includes(exists))) {
          if (testcase.error) {
            run.failed(exists,
              new TestMessage(
                testcase.error.map((v) => {
                  return this.formatErrorMessage(v)
                }).join("\n\n\n")
              ),
              testcase.time * 1000);
          } else if (testcase.failure) {
            run.failed(exists,
              new TestMessage(
                testcase.failure.map((v) => {
                  return this.formatErrorMessage(v)
                }).join("\n\n\n")
              ),
              testcase.time * 1000);
          } else {
            run.passed(exists, testcase.time * 1000);
          }
        }
      }
    });
  }

  convertJunitTestcases(testsuite: TestSuite): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (testsuite.tests === 0) {
          outputChannel.appendLine(`[Spec] Error: No testcases in testsuite ${JSON.stringify(testsuite)}`)
          return
        }

        testsuite.testcase.forEach((testcase: TestCase) => {
          const item = this.controller.createTestItem(
            testcase.file + " " + testcase.name,
            testcase.name,
            Uri.file(testcase.file)
          )

          if (testcase.hasOwnProperty('line')) {
            item.range = new Range(
              new Position(testcase.line - 1, 0),
              new Position(testcase.line - 1, 0)
            );
          }

          const projectRoot = getProjectRoot(Uri.file(testcase.file))
          let fullPath = path.dirname(projectRoot.uri.fsPath);
          let specFolder = path.join(projectRoot.uri.fsPath, 'spec');
          let parent: TestItem | null = null

          // split the testcase.file and iterate over every folder in workspace
          testcase.file.replace(fullPath, "")
            .split(path.sep)
            .filter((folder => folder !== ""))
            .forEach((node: string) => {
              // build full path of folder
              fullPath += path.sep + node

              // Don't create a node for the "spec" folder itself
              if (fullPath === specFolder) return;

              // check if folder exists in test controller
              const exists = this.controller.items.get(fullPath)
              if (exists) {
                // if it does, get it
                parent = exists
              } else if (parent) {
                let childMatch = null
                parent.children.forEach((child) => {
                  if (childMatch === null && child.id === fullPath) {
                    childMatch = child
                  }
                })

                if (childMatch !== null) {
                  parent = childMatch
                } else {
                  // if it doesn't and has a parent, create an item and make it a child of the parent
                  let child = this.controller.createTestItem(fullPath, node, Uri.file(fullPath))
                  parent.children.add(child)
                  parent = child
                }
              } else {
                // if don't already have a parent, use controller.items
                let child = this.controller.createTestItem(fullPath, node, Uri.file(fullPath))
                this.controller.items.add(child)
                parent = child
              }
            })

          // add testcases to last parent
          parent.children.add(item)
        })
        resolve()

      } catch (err) {
        outputChannel.appendLine(`[Spec] Error: ${err.message}`)
        reject(err);
      }
    })
  }

  private deleteTestItem(id: string) {
    this.controller.items.forEach((child) => {
      var item = this.findTestItem(id, child);
      if (item !== undefined) {
        item.children.forEach((c) => {
          item.children.delete(c.id);
        });
      } else if (child.id === id) {
        this.controller.items.delete(id)
      }
    });
  }

  private deleteProjectTestItems(workspace: WorkspaceFolder) {
    this.controller.items.forEach((child) => {
      if (child.uri.fsPath.startsWith(workspace.uri.fsPath)) {
        this.deleteTestItem(child.uri.fsPath)
      }
    })
  }

  private formatErrorMessage(v: junit2json.Details): string {
    return `\n  ${v.message.replace("\n", "\n  ")}\n\n${v.inner}`
  }
}


export type TestSuite = junit2json.TestSuite & {
  tests?: number;
  skipped?: number;
  errors?: number;
  failures?: number;
  time?: number;
  timestamp?: string;
  hostname?: string;
  testcase?: TestCase[];
}

export type TestCase = junit2json.TestCase & {
  file?: string;
  classname?: string;
  name?: string;
  line?: number;
  time?: number;
}

// Runs `crystal spec --junit temp_file`
export async function spawnSpecTool(
  space: WorkspaceFolder,
  dry_run: boolean = false,
  paths?: string[],
  token: CancellationToken = null
): Promise<TestSuite | void> {
  // Get compiler stuff
  const compiler = await getCompilerPath();
  const compiler_version = await getCrystalVersion();
  const config = get_config();

  // create a tempfile
  const tempFile = temp.path({ suffix: ".xml" })

  // execute crystal spec
  let cmd = [
    shellEscape(compiler),
    "spec", "--junit_output", "--no-color",
    shellEscape(tempFile),
    config.get<string>("flags"), config.get<string>("spec-tags")
  ]

  // Only valid for Crystal >= 1.11
  if (dry_run && compiler_version.minor > 10) {
    cmd.push("--dry-run")
  }
  if (paths) {
    for (let path of paths) {
      cmd.push(shellEscape(path))
    }
  }
  outputChannel.appendLine(`[Spec] (${space.name}) $ ` + cmd.join(" "));

  await execAsync(cmd.join(" "), space.uri.fsPath, token)
    .catch((err) => {
      findProblems(err.stderr, space.uri);
      if (err?.signal === "SIGKILL") return;

      if (err?.stdout && err.stdout.length > 0 && err.stdout.match(/^\.*F[\.F]*\n/)) {
        outputChannel.appendLine(`[Spec] (${space.name}) Failure: ${err.stdout}`)
        return;
      }

      try {
        outputChannel.appendLine(`[Spec] (${space.name}) Error: ${err.stdout.length > 0 ? err.stdout : err.stderr}`)
      } catch {
        outputChannel.appendLine(`[Spec] (${space.name}) Error: ${JSON.stringify(err)}`)
      }
    });

  if (token?.isCancellationRequested) return;

  return readSpecResults(tempFile)
    .then(async (results) => {
      return parseJunit(results);
    })
    .catch((err) => {
      if (err?.message) {
        outputChannel.appendLine(`[Spec] (${space.name}) Error: ${err.message}`)
      } else {
        outputChannel.appendLine(`[Spec] (${space.name}) Error: ${JSON.stringify(err)}`)
      }
    });
}

function readSpecResults(file: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      if (!existsSync(file)) {
        reject(new Error("Test results file doesn't exist"));
        return;
      }

      readFile(file, (error, data) => {
        if (error) {
          reject(new Error("Error reading test results file: " + error.message));
        } else {
          resolve(data);
        }
      })
    } catch (err) {
      reject(err);
    }
  })
}

function parseJunit(rawXml: Buffer): Promise<junit2json.TestSuite> {
  return new Promise(async (resolve, reject) => {
    try {
      const output = await junit2json.parse(rawXml);
      resolve(output as TestSuite);
    } catch (err) {
      reject(err)
    }
  })
}
