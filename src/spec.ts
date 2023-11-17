import { tests, TestItem, Range, Position, Uri, WorkspaceFolder, workspace, TestRunProfileKind, TestMessage } from "vscode";
import * as junit2json from 'junit2json';
import * as path from 'path';
import { setStatusBar, spawnSpecTool } from "./tools";
import { spawn } from "child_process";
import { existsSync } from "fs";


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
            if (e.uri.scheme === "file" && this.isSpecFile(e.uri.path)) {
                this.deleteTestItem(e.uri.path);
                this.getTestCases(workspace.getWorkspaceFolder(e.uri), [e.uri.path])
            }
        });

        workspace.onDidChangeWorkspaceFolders((event) => {
            this.refreshSpecWorkspaceFolders()
            for (var i = 0; i < event.added.length; i += 1) {
                console.debug("Adding folder to workspace: " + event.added[i].uri.path)
                this.getTestCases(event.added[i])
            }
            event.removed.forEach((folder) => {
                console.debug("Removing folder from workspace: " + folder.uri.path)
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
            this.workspaceFolders.includes(workspace.getWorkspaceFolder(Uri.file(file)))
    }

    refreshSpecWorkspaceFolders(): void {
        let folders = []
        workspace.workspaceFolders.forEach((folder) => {
            if (existsSync(`${folder.uri.path}${path.sep}shard.yml`) &&
                existsSync(`${folder.uri.path}${path.sep}spec`)) {
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
        const dispose = setStatusBar('searching for specs...');

        try {
            await spawnSpecTool(workspace, true, paths)
                .then(junit => this.convertJunitTestcases(junit))
                .catch((err) => {
                    console.debug("[Spec] Error: " + err.message + "\n" + err.stack);
                })
        } finally {
            dispose()
        }
    }

    async execTestCases(workspace: WorkspaceFolder, paths?: string[]): Promise<junit2json.TestSuite> {
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
            const run = this.controller.createTestRun(request);
            const start = Date.now();

            let runnerArgs = []
            this.controller.items.forEach((item) => {
                let generated = this.generateRunnerArgs(item, request.include, request.exclude)
                if (generated.length > 0) {
                    runnerArgs = runnerArgs.concat(generated)
                }
            })

            let workspaces: WorkspaceFolder[] = []
            runnerArgs.forEach((arg) => {
                const uri = Uri.file(arg)
                const space = workspace.getWorkspaceFolder(uri)
                if (space !== undefined && !workspaces.includes(space)) {
                    workspaces.push(space)
                }
            })

            for (var i = 0; i < workspaces.length; i++) {
                let args = []
                runnerArgs.forEach((arg) => {
                    if (workspaces[i] == workspace.getWorkspaceFolder(Uri.file(arg))) {
                        args.push(arg)
                    }
                })
                let result: junit2json.TestSuite
                try {
                    result = await this.execTestCases(workspaces[i], args)
                } catch (err) {
                    console.debug("Error: " + err.message)
                    run.end()
                    return
                }

                result.testcase.forEach((testcase) => {
                    let exists = undefined
                    this.controller.items.forEach((child: TestItem) => {
                        if (exists === undefined) {
                            // @ts-expect-error
                            exists = this.getChild(testcase.file + " " + testcase.name, child)
                        }
                    })

                    if (exists) {
                        if (!(request.include && request.include.includes(exists)) || !(request.exclude?.includes(exists))) {
                            if (testcase.error) {
                                run.failed(exists,
                                    new TestMessage(
                                        testcase.error.map((v) => `${v.inner}\n${v.message}`).join("\n\n")
                                    ),
                                    testcase.time * 1000)
                            } else if (testcase.failure) {
                                run.failed(exists,
                                    new TestMessage(
                                        testcase.failure.map((v) => `${v.inner}\n${v.message}`).join("\n\n")
                                    ),
                                    testcase.time * 1000)
                            } else {
                                run.passed(exists, testcase.time * 1000)
                            }
                        }
                    }
                })
            }

            console.debug(`Finished execution in ${Date.now() - start}ms`)
            run.end();
        }
    );

    generateRunnerArgs(item: TestItem, includes: readonly TestItem[], excludes: readonly TestItem[]): string[] {
        if (includes) {
            if (includes.includes(item)) {
                return [item.uri.path]
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
            return [item.uri.path]
        }
    }

    private deleteWorkspaceChildren(workspace: WorkspaceFolder) {
        this.controller.items.forEach((child) => {
            if (child.uri.path.startsWith(workspace.uri.path)) {
                this.deleteTestItem(child.uri.path)
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

    convertJunitTestcases(testsuite: junit2json.TestSuite): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (testsuite.tests === 0) {
                    console.debug(`Error: No testcases in testsuite ${JSON.stringify(testsuite)}`)
                    return
                }

                testsuite.testcase.forEach((testcase) => {
                    const item = this.controller.createTestItem(
                        // @ts-expect-error
                        testcase.file + " " + testcase.name,
                        testcase.name,
                        // @ts-expect-error
                        Uri.file(testcase.file)
                    )

                    if (testcase.hasOwnProperty('line')) {
                        item.range = new Range(
                            // @ts-expect-error
                            new Position(testcase.line - 1, 0),
                            // @ts-expect-error
                            new Position(testcase.line - 1, 0)
                        );
                    }

                    // @ts-expect-error
                    let fullPath = workspace.getWorkspaceFolder(Uri.file(testcase.file)).uri.path +
                        path.sep + 'spec';
                    let parent: TestItem | null = null

                    // split the testcase.file and iterate over every folder in workspace
                    // @ts-expect-error
                    testcase.file.replace(fullPath, "").split(path.sep).filter((folder => folder !== "")).forEach((node: string) => {
                        // build full path of folder
                        fullPath += path.sep + node
                        // console.debug("Node: " + node)
                        // console.debug("fullPath: " + fullPath)

                        // check if folder exists in test controller
                        const exists = this.controller.items.get(fullPath)
                        if (exists) {
                            // if it does, get it
                            // console.debug("Node exists: " + exists.uri.path)
                            parent = exists
                        } else if (parent) {
                            let childMatch = null
                            parent.children.forEach((child) => {
                                if (childMatch === null && child.id === fullPath) {
                                    childMatch = child
                                }
                            })

                            if (childMatch !== null) {
                                // console.debug("Found match in parent children: " + childMatch.uri.path)
                                parent = childMatch
                            } else {
                                // if it doesn't and has a parent, create an item and make it a child of the parent
                                let child = this.controller.createTestItem(fullPath, node, Uri.file(fullPath))
                                // console.debug("Creating node under parent: " + parent.uri.path + " => " + node)
                                parent.children.add(child)
                                parent = child
                            }
                        } else {
                            // if don't already have a parent, use controller.items
                            // console.debug("Creating node under root: " + fullPath)
                            let child = this.controller.createTestItem(fullPath, node, Uri.file(fullPath))
                            this.controller.items.add(child)
                            parent = child
                        }
                    })

                    // add testcases to last parent
                    // console.debug("Adding testcase " + testcase.file + " to " + parent.uri.path)
                    parent.children.add(item)
                    // console.debug("")
                })
                resolve()

            } catch (err) {
                console.debug(`[Spec] Error: ${err.message}`)
                reject(err);
            }
        })
    }
}
