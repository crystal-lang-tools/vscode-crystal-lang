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
import { setStatusBar, spawnContextTool } from './tools';

class CrystalHoverProvider implements HoverProvider {
    async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
        const line = document.lineAt(position.line);
        if (!line.text || /^#(?!{).+/.test(line.text)) return;

        const text = document.getText(document.getWordRangeAtPosition(position));
        if (KEYWORDS.includes(text)) return;

        const dispose = setStatusBar('Crystal: running context tool...');
        try {
            const res = await spawnContextTool(document, position);
            if (res.status === 'ok') {
                const ctx = res.contexts!.find(c => c[text]);
                if (!ctx) return;

                dispose();
                const md = new MarkdownString().appendCodeblock(ctx[text], 'crystal');
                return new Hover(md);
            }
        } catch (err) {
            console.error(`Crystal context tool failed: ${err}`);
        }

        // TODO: implement symbol check
        dispose();
    }
}

export function registerHover(selector: DocumentSelector, context: ExtensionContext): void {
    context.subscriptions.push(languages.registerHoverProvider(selector, new CrystalHoverProvider()));
}
