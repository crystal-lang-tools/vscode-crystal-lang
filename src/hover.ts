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
import { KEYWORDS } from './definitions';
import {
	ContextError,
	getCrystalLibPath,
	getMainForShard,
	setStatusBar,
	spawnContextTool,
} from './tools';

class CrystalHoverProvider implements HoverProvider {
	async provideHover(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): Promise<Hover> {
		const line = document.lineAt(position.line);
		if (!line.text || /^#(?!{).+/.test(line.text)) return;
		if (/"(\.{1,2}\/[\w\*\/]+)"/.test(line.text))
			return await this.provideLocalRequireHover(document, line);

		if (/"([\w\/v-]+)"/.test(line.text))
			return await this.provideShardRequireHover(document, line);

		const text = document.getText(document.getWordRangeAtPosition(position));
		if (KEYWORDS.includes(text)) return; // TODO: potential custom keyword highlighting/info support? Rust??

		const dispose = setStatusBar('running context tool...');
		try {
			console.debug('[Hover] getting context...');
			const res = await spawnContextTool(document, position);

			if (res.status !== 'ok') {
				console.debug(`[Hover] failed: ${JSON.stringify(res)}`);
				return;
			}

			const ctx = res.contexts!.find(c => c[line.text]);
			console.debug(`[Hover] context: ${ctx}`);
			if (!ctx) return;

			const md = new MarkdownString().appendCodeblock(
				ctx[line.text],
				'crystal'
			);
			return new Hover(md);
		} catch (err) {
			if (err.stderr.includes('cursor location must be')) {
				console.debug('[Hover] failed to get correct cursor location');
				return;
			}
			const res = JSON.parse(err.stderr)[0] as ContextError;

			const lines = res.message.split('\n');
			const msg = 'Error: ' + lines.filter(t => !t.startsWith(' -')).join('\n');
			const overloads = lines.filter(t => t.startsWith(' -'));
			const md = new MarkdownString().appendCodeblock(msg, 'text');

			overloads.map(o => md.appendCodeblock(o, 'crystal'));
			return new Hover(md);
		} finally {
			dispose();
		}
		// TODO: implement symbol check
		// private provideSymbolContext()
	}

	private async provideLocalRequireHover(
		document: TextDocument,
		line: TextLine
	): Promise<Hover> {
		const dirname = workspace.getWorkspaceFolder(document.uri).name;
		const md = new MarkdownString();
		let match = /"(\.{1,2}\/[\w\*\/]+)"/.exec(line.text)[1];
		console.debug('[Hover] identifying local require');

		if (match.includes('*')) {
			console.debug(`[Hover] globbing: ${path.join('src', match)}`);
			const files = await workspace.findFiles(path.join('src', match));
			if (!files.length) return;
			const lines: string[] = [];

			for (let file of files.slice(0, 10)) {
				let relative = path.join('.', file.path.split(dirname)[1]);
				lines.push(`require "${relative}"`);
			}
			lines.sort();

			const extra = files.length - 10;
			if (extra > 0) lines.push(`\n...and ${extra} more`);
			md.appendCodeblock(
				lines.join('\n').replace(/\\+/g, '/'),
				'crystal'
			).appendText(`Resolved ${files.length} sources.`);
		} else {
			if (!match.endsWith('.cr')) match += '.cr';
			const dir = path.dirname(document.fileName);
			const src = path.resolve(dir, match);
			if (!existsSync(src)) return;
			console.debug(`[Hover] resolved: ${src}`);

			const relative = path
				.join('.', src.split(dirname)[1])
				.replace(/\\+/g, '/');

			md.appendCodeblock(`require "${relative}"`, 'crystal').appendMarkdown(
				`[Go to source](file:///${src})`
			);
		}

		return new Hover(md, line.range);
	}

	private async provideShardRequireHover(
		document: TextDocument,
		line: TextLine
	): Promise<Hover> {
		const dirname = workspace.getWorkspaceFolder(document.uri).name;
		const md = new MarkdownString();
		const match = /"([\w\/v-]+)"/.exec(line.text)[1];
		console.debug('[Hover] identifying shard/lib require');

		const main = getMainForShard(document, match);
		if (main) {
			console.debug(`[Hover] resolved: ${main}`);

			const relative = path
				.join('.', main.split(dirname)[1])
				.replace(/\\+/g, '/');

			md.appendCodeblock(`require "${relative}"`, 'crystal').appendMarkdown(
				`[Go to source](file:///${main})`
			);
		} else {
			try {
				console.debug('[Hover] getting crystal path...');
				const libpath = await getCrystalLibPath();
				let fp = path.join(libpath, match);
				if (!existsSync(fp)) {
					fp += '.cr';
					if (!existsSync(fp)) return;
				}
				console.debug(`[Hover] resolved: ${fp}`);

				if (!fp.endsWith('.cr')) {
					if (existsSync(fp + '.cr')) {
						fp += '.cr';
					} else {
						// TODO: levenshtein the fuck out of this
						fp = path.join(fp, readdirSync(fp)[0]);
						console.debug(`[Hover] expanded to: ${fp}`);
					}
				}

				md.appendCodeblock(`require "${match}"`, 'crystal').appendMarkdown(
					`[Go to source](file:///${fp})`
				);
			} catch (err) {
				console.debug(`[Hover] failed: ${err.stderr}`);
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
