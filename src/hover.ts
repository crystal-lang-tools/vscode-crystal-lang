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
import { MarkedString } from 'vscode-languageclient';
import { KEYWORDS } from './definitions';
import { setStatusBar, spawnContextTool } from './tools';

class CrystalHoverProvider implements HoverProvider {
    async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
        const line = document.lineAt(position.line);
        if (!line.text || /^#(?!{).+/.test(line.text)) return;

        const text = document.getText(document.getWordRangeAtPosition(position));
        if (KEYWORDS.includes(text)) return;

        const dispose = setStatusBar('running context tool...');
        try {
            const res = await spawnContextTool(document, position);
			console.log("text: ", text)
			console.log(res)
            if (res.status === 'ok') {
                const ctx = res.contexts!.find(c => c[line.text]);
				console.log(ctx)
                if (!ctx) return;

                dispose();
                const md = new MarkdownString().appendCodeblock(ctx[line.text], 'crystal');
                return new Hover(md);
            }
        } catch (err) {
			console.log(err.output)
			const md = new MarkdownString().appendCodeblock(JSON.parse(err.output.stderr)[0].message, 'crystal');
            return new Hover(md)
        }

        // TODO: implement symbol check
        dispose();
    }
}

export function registerHover(selector: DocumentSelector, context: ExtensionContext): void {
    context.subscriptions.push(languages.registerHoverProvider(selector, new CrystalHoverProvider()));
}
