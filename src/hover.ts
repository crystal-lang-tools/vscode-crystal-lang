import {
    CancellationToken,
    DocumentSelector,
    ExtensionContext,
    Hover,
    HoverProvider,
    languages,
    MarkdownString,
    Position,
    TextDocument
} from 'vscode';
import { KEYWORDS } from './definitions';
import { ContextError, setStatusBar, spawnContextTool } from './tools';

class CrystalHoverProvider implements HoverProvider {
    async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
        const line = document.lineAt(position.line);
        if (!line.text || /^#(?!{).+/.test(line.text)) return;

        const text = document.getText(document.getWordRangeAtPosition(position));
        if (KEYWORDS.includes(text)) return; // TODO: potential custom keyword highlighting/info support? Rust??

        const dispose = setStatusBar('running context tool...');
        try {
            const res = await spawnContextTool(document, position);
			console.log("text: ", text)
			console.log(res)
            dispose();
            if (res.status !== 'ok') return;

            const ctx = res.contexts!.find(c => c[line.text]);
            console.debug(ctx);
            if (!ctx) return;

            const md = new MarkdownString().appendCodeblock(ctx[line.text], 'crystal');
            return new Hover(md);
        } catch (err) {
            dispose();

            const res = <ContextError> JSON.parse(err.stderr)[0];
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

export function registerHover(selector: DocumentSelector, context: ExtensionContext): void {
    context.subscriptions.push(languages.registerHoverProvider(selector, new CrystalHoverProvider()));
}
