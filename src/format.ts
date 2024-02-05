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
} from 'vscode';
import { crystalOutputChannel, findProblemsRaw, getCompilerPath, setStatusBar } from './tools';
import { spawn } from 'child_process';

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
		if (document.fileName.endsWith(".ecr")) return;

		const dispose = setStatusBar('running format tool...');
		try {
			crystalOutputChannel.appendLine('[Format] formatting...');
			const format = await spawnFormatTool(document);
			if (!format.length) return;

			return [TextEdit.replace(getFormatRange(document), format)];
		} catch (err) {
			if (!err) return;

			crystalOutputChannel.appendLine(`[Format] failed: ${err}`);
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

async function spawnFormatTool(document: TextDocument): Promise<string> {
	const compiler = await getCompilerPath();

	return await new Promise((res, rej) => {
		const child = spawn(
			compiler,
			['tool', 'format', '--no-color', '-'],
			{ shell: process.platform == "win32" }
		);

		child.stdin.write(document.getText());
		child.stdin.end();

		const out: string[] = [];
		const err: string[] = [];

		child.stdout
			.setEncoding('utf-8')
			.on('data', d => out.push(d));

		child.stderr
			.setEncoding('utf-8')
			.on('data', d => err.push(d));

		child.on('close', () => {
			if (err.length > 0) {
				const err_resp = err.join('') + "\n" + out.join('')
				findProblemsRaw(err_resp, document.uri)
				rej(err_resp);
			} else {
				const out_resp = out.join('')
				findProblemsRaw(out_resp, document.uri)
				res(out_resp);
			}
		})
	});
}
