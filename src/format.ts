import {
    languages,
    window,
    CancellationToken,
    DocumentFormattingEditProvider,
    DocumentSelector,
    ExtensionContext,
    FormattingOptions,
    Range,
    TextDocument,
    TextEdit
} from 'vscode';
import { spawnFormatTool } from './tools';

export function getFormatRange(document: TextDocument): Range {
    return new Range(
        0,
        0,
        document.lineCount,
        document.lineAt(document.lineCount - 1).text.length
    );
}

class CrystalFormattingEditProvider implements DocumentFormattingEditProvider {
    async provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[]> {
        try {
            const format = await spawnFormatTool(document);
            return [TextEdit.replace(getFormatRange(document), format)];
        } catch (err) {
            console.error(err);
            window.showErrorMessage(`Failed to execute Crystal context tool: ${err}`);
            return [];
        }
    }
}

export function registerFormatter(selector: DocumentSelector, context: ExtensionContext): void {
    context.subscriptions.push(
        languages.registerDocumentFormattingEditProvider(selector, new CrystalFormattingEditProvider())
    );
}
