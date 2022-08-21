import * as vscode from 'vscode';
import { spawn } from 'child_process';

export class CrystalFormattingProvider implements vscode.DocumentFormattingEditProvider {
    async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        try {
            const format = await this.getFormatting(document);
            const range = new vscode.Range(
                0,
                0,
                document.lineCount - 1,
                document.lineAt(document.lineCount - 1).text.length
            );
            return [vscode.TextEdit.replace(range, format)];
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    private getFormatting(document: vscode.TextDocument): Promise<string> {
        return new Promise<string>((res, rej) => {
            const config = vscode.workspace.getConfiguration('crystal-lang');
            const child = spawn(
                config.get<string>('compiler'),
                ['tool', 'format', '--no-color', '-']
            );
            child.stdin.write(document.getText());
            child.stdin.end();

            const out: string[] = [];
            const err: string[] = [];

            child.stdout
                .setEncoding('utf-8')
                .on('data', d => out.push(d))
                .on('end', () => res(out.join()));

            child.stderr
                .setEncoding('utf-8')
                .on('data', d => err.push(d))
                .on('end', () => rej(err.join()));
        });
    }
}
