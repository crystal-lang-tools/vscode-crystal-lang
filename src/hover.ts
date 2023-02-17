import { existsSync } from 'fs';
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
import { ContextError, setStatusBar, spawnContextTool } from './tools';

class CrystalHoverProvider implements HoverProvider {
	async provideHover(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): Promise<Hover> {
		const line = document.lineAt(position.line);
		if (!line.text || /^#(?!{).+/.test(line.text)) return;
		if (/^\s*require\s+".*"/.test(line.text))
			return await this.provideRequireHover(document, line);

		const text = document.getText(document.getWordRangeAtPosition(position));
		if (KEYWORDS.includes(text)) return; // TODO: potential custom keyword highlighting/info support? Rust??

		const dispose = setStatusBar('running context tool...');
		try {
			console.debug('[Hover] getting context...');
			const res = await spawnContextTool(document, position);

			if (res.status !== 'ok') {
				console.debug(`[Hover] failed: ${res}`);
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

	private async provideRequireHover(
		document: TextDocument,
		line: TextLine
	): Promise<Hover> {
		let match = /"(\.{1,2}\/[\w\*\/]+)"/.exec(line.text)[1];
		const dirname = workspace.getWorkspaceFolder(document.uri).name;
		const md = new MarkdownString();

		if (match) {
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
					.replace(/\\+/, '/');

				md.appendCodeblock(`require "${relative}"`, 'crystal').appendMarkdown(
					`[Go to source](file:///${src})`
				);
			}

			return new Hover(md, line.range);
		}

		// TODO: add shards lookup
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
