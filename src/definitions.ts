import { existsSync } from 'fs';
import * as path from 'path';
import {
	CancellationToken,
	Definition,
	DefinitionProvider,
	DocumentSelector,
	ExtensionContext,
	languages,
	Location,
	LocationLink,
	Position,
	TextDocument,
	Uri,
	workspace,
	WorkspaceFolder,
} from 'vscode';
import { crystalOutputChannel, execAsync, findProblems, getCompilerPath, getCursorPath, getShardMainPath, getWorkspaceFolder, shellEscape } from './tools';

class CrystalDefinitionProvider implements DefinitionProvider {
	async provideDefinition(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): Promise<LocationLink[] | Definition> {
		const line = document.lineAt(position.line);
		const matches = /^require\s+"(.+)"\s*$/.exec(line.text);

		if (matches?.length > 1) {
			let text = matches[1];
			if (text.includes('*')) return [];
			const dir = path.dirname(document.fileName);
			crystalOutputChannel.appendLine(`[Implementations] identified: ${text}`);

			if (/^\.{1,2}\/\w+/.test(text)) {
				if (!text.endsWith('.cr')) text += '.cr';
				const loc = path.join(dir, text);
				if (!existsSync(loc)) return [];

				return new Location(Uri.file(loc), new Position(0, 0));
			}

			// TODO: implement shard lookup
			return [];
		}

		try {
			crystalOutputChannel.appendLine('[Implementations] getting implementations...');
			const res = await spawnImplTool(document, position);
			if (res.status !== 'ok') {
				crystalOutputChannel.appendLine(`[Implementations] failed: ${res.message}`);
				return [];
			}

			const links: Location[] = [];
			for (let impl of res.implementations!) {
				links.push(
					new Location(
						Uri.file(impl.filename),
						new Position(impl.line - 1, impl.column - 1)
					)
				);
			}

			return links;
		} catch (err) {
			if (err.stderr) {
				findProblems(err.stderr, document.uri)
				crystalOutputChannel.appendLine(`[Implementations] failed: ${err.stderr}`)
			} else if (err.message) {
				crystalOutputChannel.appendLine(`[Implementations] failed: ${err.message}`);
			} else {
				crystalOutputChannel.appendLine(`[Implementations] failed: ${JSON.stringify(err)}`);
			}
			return [];
		}
	}
}

export function registerDefinitions(
	selector: DocumentSelector,
	context: ExtensionContext
): void {
	context.subscriptions.push(
		languages.registerDefinitionProvider(
			selector,
			new CrystalDefinitionProvider()
		)
	);
}

interface ImplResponse {
	status: string;
	message: string;
	implementations?: {
		line: number;
		column: number;
		filename: string;
	}[];
}

async function spawnImplTool(
	document: TextDocument,
	position: Position
): Promise<ImplResponse> {
	const compiler = await getCompilerPath();
	const config = workspace.getConfiguration('crystal-lang');
	const cursor = getCursorPath(document, position);
	const main = await getShardMainPath(document);
	if (!main) return;

	const cmd = `${shellEscape(compiler)} tool implementations -c ${shellEscape(cursor)} ${shellEscape(main)} -f json --no-color ${config.get<string>("flags")}`
	const folder: WorkspaceFolder = getWorkspaceFolder(document.uri)

	crystalOutputChannel.appendLine(`[Implementations] (${folder.name}) $ ${cmd}`);

	return JSON.parse(
		await execAsync(cmd, folder.uri.fsPath, `crystal-${folder.name}-${path.basename(main)}`)
	);
}
