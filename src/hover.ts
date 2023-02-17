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

		const text = document.getText(document.getWordRangeAtPosition(position));
		if (KEYWORDS.includes(text)) return; // TODO: potential custom keyword highlighting/info support? Rust??

		const dispose = setStatusBar('running context tool...');
		try {
			console.debug('[Hover] getting context...');
			const res = await spawnContextTool(document, position);
			dispose();
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
			dispose();

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
		}

		// TODO: implement symbol check
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
