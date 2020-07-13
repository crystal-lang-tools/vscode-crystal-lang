import {ExtensionContext, Task, TaskDefinition, ShellExecution, ShellExecutionOptions, TextDocument, WorkspaceFolder, WorkspaceFoldersChangeEvent, TaskGroup, TaskPresentationOptions, TaskRevealKind, TaskPanelKind, Disposable, Uri, workspace, TaskProvider} from "vscode"
import * as path from 'path'
import * as fs from 'fs'
import * as YAML from 'yaml'

// Copy from https://github.com/rust-lang/rls-vscode/blob/master/src/tasks.ts
export function registerCrystalTask(context: ExtensionContext): void {
	workspace.onDidOpenTextDocument((doc) => DidOpenTextDocument(doc, context))
	workspace.textDocuments.forEach((doc) => DidOpenTextDocument(doc, context))
	workspace.onDidChangeWorkspaceFolders((e) => didChangeWorkspaceFolders(e, context));
}

export function DidOpenTextDocument(document: TextDocument, context: ExtensionContext): void {
	if (document.languageId !== 'crystal') {
		return
	}

	const uri = document.uri
	let folder = workspace.getWorkspaceFolder(uri)
	if (!folder){
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
			if (uri.charAt(uri.length - 1) !== '/') {
					uri = uri + '/';
			}
			if (uri.startsWith(element)) {
					return workspace.getWorkspaceFolder(Uri.parse(element)) || folder;
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
					if (result.charAt(result.length - 1) !== '/') {
							result = result + '/';
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
		this.disposables.push(this.registerTaskProvider())
	}

	async stop() {
		let promise: Thenable<void> = Promise.resolve(void 0)
		return promise.then(() => {
			this.disposables.forEach(d => d.dispose())
		})
	}

	registerTaskProvider() : Disposable {
		let provider: TaskProvider = new CrystalTaskProvider(this.folder);
		const disposable = workspace.registerTaskProvider('crystal', provider);
		return disposable
	}
}

class CrystalTaskProvider implements TaskProvider {
	constructor(private _workspaceFolder: WorkspaceFolder) {
	}

	public provideTasks() {
		return getCrystalTasks(this._workspaceFolder)
	}

	public resolveTask(_task : Task): Task | undefined {
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

function getCrystalTasks(target: WorkspaceFolder): Task[] {
	const taskList = createCrystalTaskConfigItem(target)
	const list = taskList.map((def) => {
		const task = createCrystalTask(def, target)
		return task
	})

	return list
}

function createCrystalTask({ definition, group, presentationOptions, problemMatcher }: TaskConfigItem, target: WorkspaceFolder): Task {
	let taskBin = getCrystalCompiler(target)
	let taskArgs: Array<string> = (definition.args !== undefined) ? definition.args : []
	if (definition.file !== undefined) {
		taskArgs.push(definition.file)
	}

	let source = 'Crystal'
	if (definition.type !== 'crystal') {
		taskBin = getShardsPath(target)
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

const CRYSTAL_TASKS: Array<{type: string, command: string, args?: Array<string>, group: TaskGroup}> = [
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
		group: TaskGroup.Clean
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

function createCrystalTaskConfigItem(target: WorkspaceFolder): Array<TaskConfigItem> {
	const problemMatcher = []
	const presentationOptions: TaskPresentationOptions = {
		reveal: TaskRevealKind.Always,
		panel: TaskPanelKind.Dedicated,
	}
	const mainFile = getMainFile(target)
	const tasks = CRYSTAL_TASKS.map((opt) => {
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

function getCrystalCompiler(folder: WorkspaceFolder): string {
	return workspace.getConfiguration('crystal-lang', folder.uri).get<string>('compiler', 'crystal')
}

function getShardsPath(folder: WorkspaceFolder): string {
	return workspace.getConfiguration('crystal-lang', folder.uri).get<string>('shards', 'shards')
}

function getMainFile(folder: WorkspaceFolder): string {
	const shardFile = getShardFile()
	if (fs.existsSync(shardFile)) {
		const io = fs.readFileSync(shardFile, 'utf8')
		const data = YAML.parse(io)

		if (data.targets !== undefined) {
			const values = Object.keys(data.targets).map(key => data.targets[key])
			// NOTE: match first targets
			if (values.length > 0) {
				return values[0].main
			}
		}
	}

	const defaultMainFile = workspace.getConfiguration('crystal-lang', folder.uri).get<string>('mainFile', 'main.cr')
	return defaultMainFile
}

function getShardFile(): string {
	const workspaceRoot = workspace.rootPath;
	const shardFile = path.join(workspaceRoot, 'shard.yml')
	return shardFile
}
