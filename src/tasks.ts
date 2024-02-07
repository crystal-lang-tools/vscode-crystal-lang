import { ExtensionContext, Task, TaskDefinition, ShellExecution, ShellExecutionOptions, TextDocument, WorkspaceFolder, WorkspaceFoldersChangeEvent, TaskGroup, TaskPresentationOptions, TaskRevealKind, Disposable, Uri, workspace, TaskProvider, tasks, TaskPanelKind } from "vscode"
import { getCompilerPath, getMainFile, getShardsPath, getWorkspaceFolder } from "./tools"
import * as path from "path"

// Copy from https://github.com/rust-lang/rls-vscode/blob/master/src/tasks.ts
export function registerTasks(context: ExtensionContext): void {
  workspace.onDidOpenTextDocument((doc) => DidOpenTextDocument(doc, context), null, context.subscriptions)
  workspace.textDocuments.forEach((doc) => DidOpenTextDocument(doc, context))
  workspace.onDidChangeWorkspaceFolders((e) => didChangeWorkspaceFolders(e, context), null, context.subscriptions);
}

export function DidOpenTextDocument(document: TextDocument, context: ExtensionContext): void {
  if (document.languageId !== 'crystal') {
    return
  }

  const uri = document.uri
  let folder = getWorkspaceFolder(uri)
  if (!folder) {
    return
  }

  folder = getOuterMostWorkspaceFolder(folder);
  if (!workspaces.has(folder.uri.toString())) {
    const client = new CrystalTaskClient(folder)
    workspaces.set(folder.uri.toString(), client)
    client.start(context)
  }
}

export function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
  const sorted = sortedWorkspaceFolders();
  for (const element of sorted) {
    let uri = folder.uri.toString();
    if (uri.charAt(uri.length - 1) !== path.sep) {
      uri = uri + path.sep;
    }
    if (uri.startsWith(element)) {
      return getWorkspaceFolder(Uri.parse(element)) || folder;
    }
  }
  return folder;
}

// This is an intermediate, lazy cache used by `getOuterMostWorkspaceFolder`
// and cleared when VSCode workspaces change.
let _sortedWorkspaceFolders: string[] | undefined;

export function sortedWorkspaceFolders(): string[] {
  if (!_sortedWorkspaceFolders && workspace.workspaceFolders) {
    _sortedWorkspaceFolders = workspace.workspaceFolders.map(folder => {
      let result = folder.uri.toString();
      if (result.charAt(result.length - 1) !== path.sep) {
        result = result + path.sep;
      }
      return result;
    }).sort(
      (a, b) => {
        return a.length - b.length;
      }
    );
  }
  return _sortedWorkspaceFolders || [];
}

export function didChangeWorkspaceFolders(e: WorkspaceFoldersChangeEvent, context: ExtensionContext): void {
  _sortedWorkspaceFolders = undefined;

  // If a VSCode workspace has been added, check to see if it is part of an existing one, and
  // if not, and it is a Rust project (i.e., has a Cargo.toml), then create a new client.
  for (let folder of e.added) {
    folder = getOuterMostWorkspaceFolder(folder);
    if (workspaces.has(folder.uri.toString())) {
      continue;
    }

    const client = new CrystalTaskClient(folder)
    workspaces.set(folder.uri.toString(), client)
    client.start(context)
  }

  // If a workspace is removed which is a Crystal workspace, kill the client.
  for (const folder of e.removed) {
    const client = workspaces.get(folder.uri.toString());
    if (client) {
      workspaces.delete(folder.uri.toString());
      client.stop()
    }
  }
}

const workspaces: Map<string, CrystalTaskClient> = new Map();

class CrystalTaskClient {
  readonly folder: WorkspaceFolder;
  disposables: Disposable[];

  constructor(folder: WorkspaceFolder) {
    this.folder = folder
    this.disposables = []
  }

  async start(context: ExtensionContext) {
    this.disposables.push(this.registerTaskProvider(TaskType.Crystal))
    this.disposables.push(this.registerTaskProvider(TaskType.Shards))
  }

  async stop() {
    let promise: Thenable<void> = Promise.resolve(void 0)
    return promise.then(() => {
      this.disposables.forEach(d => d.dispose())
    })
  }

  registerTaskProvider(taskType: TaskType): Disposable {
    let provider: TaskProvider = new CrystalTaskProvider(taskType, this.folder);
    const disposable = tasks.registerTaskProvider(taskType, provider);
    return disposable
  }
}

enum TaskType {
  Crystal = 'crystal',
  Shards = 'shards',
}

class CrystalTaskProvider implements TaskProvider {
  constructor(private _taskType: TaskType, private _workspaceFolder: WorkspaceFolder) {
  }

  public provideTasks() {
    return getCrystalTasks(this._taskType, this._workspaceFolder)
  }

  public resolveTask(_task: Task): Task | undefined {
    return undefined
  }
}

interface CrystalTaskDefinition extends TaskDefinition {
  label: string
  command: string
  args?: Array<string>
  file?: string
}

interface TaskConfigItem {
  definition: CrystalTaskDefinition
  problemMatcher: Array<string>
  group?: TaskGroup
  presentationOptions?: TaskPresentationOptions
}

async function getCrystalTasks(taskType: TaskType, target: WorkspaceFolder): Promise<Task[]> {
  const taskList = createCrystalTaskConfigItem(taskType, target)
  const list = await Promise.all(taskList.map(async (def) => {
    const task: Task = await createCrystalTask(def, target)
    return task
  }))

  return list
}

async function createCrystalTask({ definition, group, presentationOptions, problemMatcher }: TaskConfigItem, target: WorkspaceFolder): Promise<Task> {
  let taskBin = await getCompilerPath()
  let taskArgs: Array<string> = (definition.args !== undefined) ? definition.args : []
  if (definition.file !== undefined) {
    taskArgs.push(definition.file)
  }

  let source = 'Crystal'
  if (definition.type !== 'crystal') {
    taskBin = await getShardsPath()
    source = 'Shards'
  }

  const execCmd = `${taskBin} ${definition.command} ${taskArgs}`
  const execOption: ShellExecutionOptions = {
    cwd: target.uri.fsPath
  }
  const exec = new ShellExecution(execCmd, execOption)
  let label = definition.label
  if (definition.type == 'crystal' && definition.file !== undefined) {
    label = `${label} - ${definition.file}`
  }

  const task = new Task(definition, target, label, source, exec, problemMatcher)
  if (group !== undefined) {
    task.group = group
  }

  if (presentationOptions !== undefined) {
    task.presentationOptions = presentationOptions
  }

  return task
}

const CRYSTAL_TASKS: Array<{ type: string, command: string, args?: Array<string>, group: TaskGroup }> = [
  {
    type: 'crystal',
    command: 'run',
    group: TaskGroup.Build
  },
  {
    type: 'crystal',
    command: 'docs',
    group: TaskGroup.Clean
  },
  {
    type: 'crystal',
    command: 'tool format',
    group: TaskGroup.Build
  },
  {
    type: 'crystal',
    command: 'tool unreachable',
    group: TaskGroup.Build
  },
  {
    type: 'crystal',
    command: 'spec',
    group: TaskGroup.Test
  },
  {
    type: 'shards',
    command: 'install',
    group: TaskGroup.Build
  },
  {
    type: 'shards',
    command: 'update',
    group: TaskGroup.Build
  },
  {
    type: 'shards',
    command: 'build',
    args: [
      '--release'
    ],
    group: TaskGroup.Build
  },
  {
    type: 'shards',
    command: 'prune',
    group: TaskGroup.Clean
  }
]

function createCrystalTaskConfigItem(taskType: TaskType, target: WorkspaceFolder): Array<TaskConfigItem> {
  const problemMatcher = []
  const presentationOptions: TaskPresentationOptions = {
    reveal: TaskRevealKind.Always,
    panel: TaskPanelKind.Dedicated,
  }
  const mainFile = getMainFile(target)
  const tasks = CRYSTAL_TASKS.filter((task) => task.type === taskType).map((opt) => {
    const def: CrystalTaskDefinition = {
      label: opt.command,
      type: opt.type,
      command: opt.command,
      args: opt.args,
    }

    if (opt.type == 'crystal' && opt.group == TaskGroup.Build) {
      def.file = mainFile
    }

    const task = {
      definition: def,
      problemMatcher,
      group: def.group,
      presentationOptions
    }

    return task
  })

  return tasks
}
