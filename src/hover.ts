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
		if (/^\s*require\s+".*"/.test(line.text) && !line.text.includes('*'))
			return this.provideRequireHover(document, line);

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

	private provideRequireHover(document: TextDocument, line: TextLine): Hover {
		let match = /"(\.{1,2}\/[\w+\/]+)"/.exec(line.text)[1];
		if (match) {
			console.debug('[Hover] identifying local require');

			if (!match.endsWith('.cr')) match += '.cr';
			const dir = path.dirname(document.fileName);
			const src = path.resolve(dir, match);
			if (!existsSync(src)) return;
			console.debug(`[Hover] resolved: ${src}`);

			const dirname = workspace.getWorkspaceFolder(document.uri).name;
			const relative = path
				.join('.', src.split(dirname)[1])
				.replace(/\\+/, '/');
			const md = new MarkdownString()
				.appendCodeblock(`require "${relative}"`, 'crystal')
				.appendMarkdown(`[Go to source](file:///${src})`);

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
