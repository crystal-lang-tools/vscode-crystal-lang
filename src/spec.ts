import { tests, TestItem, Range, Position, Uri, WorkspaceFolder, workspace, TestRunProfileKind, TestMessage, TestRun, TestRunRequest } from "vscode";
import * as junit2json from 'junit2json';
import * as path from 'path';
import { setStatusBar, crystalOutputChannel, getWorkspaceFolder, execAsync, findProblems, getCompilerPath, shellEscape, getCrystalVersion } from "./tools";
import { existsSync, readFile } from "fs";
import { Mutex } from "async-mutex";
import temp = require("temp");

const spec_runner_mutex = new Mutex();

enum ItemType {
  File,
  TestCase
}

export class CrystalTestingProvider {
  private workspaceFolders: WorkspaceFolder[]
  private controller = tests.createTestController(
    'crystalSpecs',
    'Crystal Specs'
  )

  constructor() {
    this.refreshSpecWorkspaceFolders()
    this.refreshTestCases()


    workspace.onDidSaveTextDocument(e => {
      if (e.uri.scheme === "file" && this.isSpecFile(e.uri.fsPath)) {
        this.deleteTestItem(e.uri.fsPath);
        this.getTestCases(getWorkspaceFolder(e.uri), [e.uri.fsPath])
      }
    });

    workspace.onDidChangeWorkspaceFolders((event) => {
      this.refreshSpecWorkspaceFolders()
      for (var i = 0; i < event.added.length; i += 1) {
        crystalOutputChannel.appendLine("Adding folder to workspace: " + event.added[i].uri.fsPath)
        this.getTestCases(event.added[i])
      }
      event.removed.forEach((folder) => {
        crystalOutputChannel.appendLine("Removing folder from workspace: " + folder.uri.fsPath)
        this.deleteWorkspaceChildren(folder)
      })
    });

    this.controller.refreshHandler = async () => {
      this.refreshSpecWorkspaceFolders()
      this.controller.items.forEach((item) => {
        this.controller.items.delete(item.id)
      })
      this.refreshTestCases()
    }
  }

  isSpecFile(file: string): boolean {
    return file.endsWith('_spec.cr') &&
      this.workspaceFolders.includes(getWorkspaceFolder(Uri.file(file)))
  }

  refreshSpecWorkspaceFolders(): void {
    let folders = []
    workspace.workspaceFolders.forEach((folder) => {
      if (existsSync(`${folder.uri.fsPath}${path.sep}shard.yml`) &&
        existsSync(`${folder.uri.fsPath}${path.sep}spec`)) {
        folders.push(folder)
      }
    })
    this.workspaceFolders = folders
  }

  async refreshTestCases(): Promise<void> {
    return new Promise(async () => {
      for (var i = 0; i < this.workspaceFolders.length; i++) {
        await this.getTestCases(this.workspaceFolders[i])
      }
    })
  }

  async getTestCases(workspace: WorkspaceFolder, paths?: string[]): Promise<void> {
    if (spec_runner_mutex.isLocked()) {
      return;
    }

    const release = await spec_runner_mutex.acquire();
    const dispose = setStatusBar('searching for specs...');

    await spawnSpecTool(workspace, true, paths)
      .then((junit) => {
        if (junit) this.convertJunitTestcases(junit)
      }).finally(() => {
        release()
        dispose()
      })
  }

  async execTestCases(workspace: WorkspaceFolder, paths?: string[]): Promise<junit2json.TestSuite | void> {
    return spawnSpecTool(workspace, false, paths)
  }

  private deleteTestItem(id: string) {
    this.controller.items.forEach((child) => {
      var item = this.getChild(id, child);
      if (item !== undefined) {
        item.children.forEach((c) => {
          item.children.delete(c.id);
        });
      } else if (child.id === id) {
        this.controller.items.delete(id)
      }
    });
  }

  runProfile = this.controller.createRunProfile('Run', TestRunProfileKind.Run,
    async (request, token) => {
      if (spec_runner_mutex.isLocked()) {
        return;
      }

      const release = await spec_runner_mutex.acquire();

      const run = this.controller.createTestRun(request);
      const start = Date.now();

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
          const space = getWorkspaceFolder(uri)
          if (space !== undefined && !workspaces.includes(space)) {
            workspaces.push(space)
          }
        })

        if (token.isCancellationRequested) {
          return;
        }

        for (var i = 0; i < workspaces.length; i++) {
          let args = []
          runnerArgs.forEach((arg) => {
            if (workspaces[i] == getWorkspaceFolder(Uri.file(arg)) && !(args.includes(arg))) {
              args.push(arg)
            }
          })

          await this.execTestCases(workspaces[i], args)
            .then(result => {
              if (result) this.parseTestCaseResults(result, request, run);
            }).catch(err => {
              crystalOutputChannel.appendLine("[Spec] Error: " + err.message)
              run.end()
            });

          if (token.isCancellationRequested) {
            return;
          }
        }
      } finally {
        release();
        crystalOutputChannel.appendLine(`Finished execution in ${Date.now() - start}ms`)
        run.end();
      }

    }
  );

  private parseTestCaseResults(result: TestSuite, request: TestRunRequest, run: TestRun) {
    result.testcase.forEach((testcase: TestCase) => {
      let exists: TestItem = undefined;
      this.controller.items.forEach((child: TestItem) => {
        if (exists === undefined) {
          exists = this.getChild(testcase.file + " " + testcase.name, child);
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

  private formatErrorMessage(v: junit2json.Details): string {
    return `\n  ${v.message.replace("\n", "\n  ")}\n\n${v.inner}`
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

  private deleteWorkspaceChildren(workspace: WorkspaceFolder) {
    this.controller.items.forEach((child) => {
      if (child.uri.fsPath.startsWith(workspace.uri.fsPath)) {
        this.deleteTestItem(child.uri.fsPath)
      }
    })
  }

  getChild(id: string, parent: TestItem): TestItem | undefined {
    let foundChild = parent.children.get(id)
    if (foundChild) {
      return foundChild
    }
    parent.children.forEach((child) => {
      if (foundChild === undefined) {
        foundChild = this.getChild(id, child)
      }
    })
    return foundChild
  }

  convertJunitTestcases(testsuite: TestSuite): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (testsuite.tests === 0) {
          crystalOutputChannel.appendLine(`[Spec] Error: No testcases in testsuite ${JSON.stringify(testsuite)}`)
          return
        }

        testsuite.testcase.forEach((testcase: TestCase) => {
          if (!path.isAbsolute(testcase.file)) {
            crystalOutputChannel.appendLine(`[Spec] Error: testcase with relative file: ${testcase.file} ${testcase.name}`)
            return;
          }

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

          let fullPath = getWorkspaceFolder(Uri.file(testcase.file)).uri.fsPath + path.sep + 'spec';
          let parent: TestItem | null = null

          // split the testcase.file and iterate over every folder in workspace
          testcase.file.replace(fullPath, "").split(path.sep).filter((folder => folder !== "")).forEach((node: string) => {
            // build full path of folder
            fullPath += path.sep + node

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
        crystalOutputChannel.appendLine(`[Spec] Error: ${err.message}`)
        reject(err);
      }
    })
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
  paths?: string[]
): Promise<TestSuite | void> {
  // Get compiler stuff
  const compiler = await getCompilerPath();
  const compiler_version = await getCrystalVersion();
  const config = workspace.getConfiguration('crystal-lang');

  // create a tempfile
  const tempFile = temp.path({ suffix: ".xml" })

  // execute crystal spec
  var cmd = `${shellEscape(compiler)} spec --junit_output ${shellEscape(tempFile)} --no-color ${config.get<string>("flags")} ${config.get<string>("spec-tags")}`;
  // Only valid for Crystal >= 1.11
  if (dry_run && compiler_version.minor > 10) {
    cmd += ` --dry-run`
  }
  if (paths) {
    cmd += ` ${paths.map((i) => shellEscape(i)).join(" ")}`
  }
  crystalOutputChannel.appendLine(`[Spec] (${space.name}) $ ` + cmd);

  await execAsync(cmd, space.uri.fsPath).catch((err) => {
    if (err.stderr) {
      findProblems(err.stderr, space.uri)
    } else if (err.message) {
      crystalOutputChannel.appendLine(`[Spec] Error: ${err.message}`)
    } else {
      crystalOutputChannel.appendLine(`[Spec] Error: ${err.stdout}`)
    }
  });

  return readSpecResults(tempFile).then(async (results) => {
    return parseJunit(results);
  }).catch((err) => {
    if (err.message) {
      crystalOutputChannel.appendLine(`[Spec] Error: ${err.message}`)
    } else {
      crystalOutputChannel.appendLine(`[Spec] Error: ${JSON.stringify(err)}`)
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
