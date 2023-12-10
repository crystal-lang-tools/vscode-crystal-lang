import { existsSync, readdirSync } from 'fs';
import * as path from 'path';
import {
	CancellationToken,
	DocumentSelector,
	ExtensionContext,
	Hover,
	HoverProvider,
	languages,
	MarkdownString,
	Position,
	TextDocument,
	TextLine,
	workspace,
} from 'vscode';
import { KEYWORDS } from './definitions/index';
import {
	crystalOutputChannel,
	findProblems,
	getCrystalLibPath,
	getMainForShard,
	setStatusBar,
	compiler_mutex,
	getWorkspaceFolder,
	getCompilerPath,
	execAsync,
	getCursorPath,
	getShardMainPath,
	shellEscape
} from './tools';
import { crystalConfiguration } from './extension';

class CrystalHoverProvider implements HoverProvider {
	previousDoc = undefined;
	previousText = "";

	async provideHover(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): Promise<Hover> {
		if (compiler_mutex.isLocked()) return;

		const line = document.lineAt(position.line);
		if (!line.text || /^#(?!{).+/.test(line.text)) return;
		if (/require\s+"(\.{1,2}\/[\w\*\/]+)"/.test(line.text))
			return await this.provideLocalRequireHover(document, line);

		if (/require\s+"([\w\/v-]+)"/.test(line.text))
			return await this.provideShardRequireHover(document, line);

		const pattern = crystalConfiguration.wordPattern;
		const wordRange = document.getWordRangeAtPosition(position, pattern)
		const text = document.getText(wordRange);
		if (KEYWORDS.includes(text)) return; // TODO: potential custom keyword highlighting/info support? Rust??

		const dispose = setStatusBar('running context tool...');

		return await compiler_mutex.acquire()
			.then(async (release) => {
				return this.provideHoverInternal(document, position, line, text)
					.catch((err) => {
						if (err && err.stderr) {
							findProblems(err.stderr, document.uri)
							crystalOutputChannel.appendLine(`[Hover] error: ${JSON.stringify(err.stderr)}`);
						} else if (err && err.message) {
							crystalOutputChannel.appendLine(`[Hover] error: ${err.message}`);
						} else {
							crystalOutputChannel.appendLine(`[Hover] error: ${JSON.stringify(err)}`)
						}
						return undefined;
					})
					.finally(() => {
						release()
					})
			})
			.finally(() => {
				dispose()
			});
	}

	private async provideHoverInternal(document: TextDocument, position: Position, line: TextLine, text: string): Promise<Hover> {
		return new Promise(async (resolve, reject) => {
			crystalOutputChannel.appendLine('[Hover] getting context...');
			const res = await spawnContextTool(document, position)

			if (res === undefined) {
				reject(res);
				return;
			}

			if (res.status !== 'ok') {
				crystalOutputChannel.appendLine(`[Hover] failed: ${res.message}`);
				reject(res);
				return;
			}

			// TODO: Filter/select based on text around cursor position
			// will provide multiple contexts / all contexts on line
			crystalOutputChannel.appendLine(`[Hover] context: ${res.message}`)
			crystalOutputChannel.appendLine(`[Hover] context: ${JSON.stringify(res)}`)

			var ctx_key = line.text;
			var ctx = res.contexts!.find(c => c[ctx_key]);
			var ctx_value: string;

			if (ctx !== undefined) {
				ctx_value = ctx[ctx_key];
			} else {
				ctx_key = text
				ctx = res.contexts!.find(c => c[ctx_key]);
			}

			if (ctx !== undefined) {
				ctx_value = ctx[ctx_key];
			} else {
				ctx_key = text
				for (var i = 0; i < res.contexts!.length; i += 1) {
					const context: Record<string, string> = res.contexts![i]
					const key = Object.keys(context).find(key => key.includes(ctx_key))

					if (key) {
						ctx = context as Record<string, string>
						ctx_value = ctx[key]
						break
					}
				}
			}

			if (ctx === undefined || ctx_key.includes("\n")) {
				resolve(undefined);
				return;
			}

			crystalOutputChannel.appendLine(`[Hover] context: ${ctx_key}: ${JSON.stringify(ctx_value)}`);

			const md = new MarkdownString().appendCodeblock(
				ctx_key + " : " + ctx_value,
				'crystal'
			);
			resolve(new Hover(md));
		})
	}

	// TODO: implement symbol check
	// private provideSymbolContext()

	private async provideLocalRequireHover(
		document: TextDocument,
		line: TextLine
	): Promise<Hover> {
		const folder = getWorkspaceFolder(document.uri);

		const md = new MarkdownString();
		let match = /"(\.{1,2}\/[\w\*\/]+)"/.exec(line.text)[1];
		crystalOutputChannel.appendLine('[Hover] identifying local require');

		if (match.includes('*')) {
			const glob_path = path.join(path.dirname(document.uri.fsPath).replace(folder.uri.fsPath + path.sep, ""), match)
			crystalOutputChannel.appendLine(`[Hover] globbing: ${glob_path}`);
			const files = await workspace.findFiles(glob_path);
			if (!files.length) return;
			const lines: string[] = [];

			for (let file of files.slice(0, 10)) {
				lines.push(`- [${path.relative(folder.uri.fsPath, file.fsPath)}](file:${path.sep}${path.sep}${file.fsPath})`);
			}
			lines.sort();

			const extra = files.length - 10;
			if (extra > 0) lines.push(`\n...and ${extra} more`);
			md.appendText(`Resolved ${files.length} sources:\n`)
				.appendMarkdown(lines.join('\n'));
		} else {
			if (!match.endsWith('.cr')) match += '.cr';
			const dir = path.dirname(document.fileName);
			const src = path.resolve(dir, match);
			if (!existsSync(src)) return;
			crystalOutputChannel.appendLine(`[Hover] resolved: ${src}`);
			const relative = path.relative(folder.uri.fsPath, src)
			md.appendCodeblock(`require "${relative}"`, 'crystal')
				.appendMarkdown(`[Go to source](file:${path.sep}${path.sep}${src})`);
		}

		return new Hover(md, line.range);
	}

	private async provideShardRequireHover(
		document: TextDocument,
		line: TextLine
	): Promise<Hover> {
		const folder = getWorkspaceFolder(document.uri);
		const md = new MarkdownString();
		const match = /"([\w\/v-]+)"/.exec(line.text)[1];
		crystalOutputChannel.appendLine('[Hover] identifying shard/lib require');

		const main = getMainForShard(document, match);
		if (main) {
			crystalOutputChannel.appendLine(`[Hover] resolved: ${main}`);

			md.appendCodeblock(`require "${path.relative(folder.uri.fsPath, main)}"`, 'crystal').appendMarkdown(
				`[Go to source](file:${path.sep}${path.sep}${main})`
			);
		} else {
			try {
				crystalOutputChannel.appendLine('[Hover] getting crystal path...');
				const libpath = await getCrystalLibPath();
				let fp = path.join(libpath, match);
				if (!existsSync(fp)) {
					fp += '.cr';
					if (!existsSync(fp)) return;
				}
				crystalOutputChannel.appendLine(`[Hover] resolved: ${fp}`);

				if (!fp.endsWith('.cr')) {
					if (existsSync(fp + '.cr')) {
						fp += '.cr';
					} else {
						// TODO: levenshtein the fuck out of this
						fp = path.join(fp, readdirSync(fp)[0]);
						crystalOutputChannel.appendLine(`[Hover] expanded to: ${fp}`);
					}
				}

				md.appendCodeblock(`require "${match}"`, 'crystal').appendMarkdown(
					`[Go to source](file:${path.sep}${path.sep}${fp})`
				);
			} catch (err) {
				crystalOutputChannel.appendLine(`[Hover] failed: ${JSON.parse(err.stderr).message}`);
				return;
			}
		}

		return new Hover(md, line.range);
	}
}

export function registerHover(
	selector: DocumentSelector,
	context: ExtensionContext
): void {
	context.subscriptions.push(
		languages.registerHoverProvider(selector, new CrystalHoverProvider())
	);
}


interface ContextResponse {
	status: string;
	message: string;
	contexts?: Record<string, string>[];
}

interface ContextError {
	file: string;
	line: number;
	column: number;
	message: string;
}

async function spawnContextTool(
	document: TextDocument,
	position: Position,
	dry_run: boolean = false
): Promise<ContextResponse> {
	const compiler = await getCompilerPath();
	const cursor = getCursorPath(document, position);
	const config = workspace.getConfiguration('crystal-lang');
	// Spec files shouldn't have main set to something in src/
	// but are instead their own main files
	const main = await getShardMainPath(document);
	const cmd = `${shellEscape(compiler)} tool context -c ${shellEscape(cursor)} ${shellEscape(main)} -f json --no-color  ${config.get<string>("flags")}`
	const folder = getWorkspaceFolder(document.uri)

	crystalOutputChannel.appendLine(`[Context] (${folder.name}) $ ${cmd}`);

	return await execAsync(cmd, folder.uri.fsPath)
		.then((response) => {
			findProblems(response, document.uri);
			return JSON.parse(response);
		}).catch((err) => {
			findProblems(err.stderr, document.uri);
			crystalOutputChannel.appendLine(`[Context] error: ${err.stderr}`)
		})
}
