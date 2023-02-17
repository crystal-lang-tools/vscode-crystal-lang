import {
	CancellationToken,
	DocumentFormattingEditProvider,
	DocumentSelector,
	ExtensionContext,
	FormattingOptions,
	languages,
	Range,
	TextDocument,
	TextEdit,
	window,
} from 'vscode';
import { setStatusBar, spawnFormatTool } from './tools';

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
		const dispose = setStatusBar('running format tool...');
		try {
			console.debug('[Format] getting formatting...');
			const format = await spawnFormatTool(document);
			if (!format.length) return;

			return [TextEdit.replace(getFormatRange(document), format)];
		} catch (err) {
			if (!err) return;

			console.debug(`[Format] failed: ${err}`);
			window.showErrorMessage(
				`Failed to format document: ${err.replace(
					/syntax error in '.*':/,
					''
				)}.`
			);
			return [];
		} finally {
			dispose();
		}
	}
}

export function registerFormatter(
	selector: DocumentSelector,
	context: ExtensionContext
): void {
	context.subscriptions.push(
		languages.registerDocumentFormattingEditProvider(
			selector,
			new CrystalFormattingEditProvider()
		)
	);
}
