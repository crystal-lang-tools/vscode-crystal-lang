import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';
import { mainFile } from './crystalUtils';

export interface ImplementationResponse {
    status: string;
    message: string;
    implementations:{
        line: number;
        column: number;
        filename: string;
    }[];
}

export class CrystalImplementationProvider implements vscode.ImplementationProvider {
    async provideImplementation(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.LocationLink[] | vscode.Definition> {
        const line = document.lineAt(position.line);
        const match = /^require\s+"(\.\.?\/.+)"\s*$/g.exec(line.text);

        if (match.length) {
            const location = path.join(
                path.dirname(document.fileName),
                match[0].endsWith('.cr') ? match[1] : match[1] + '.cr'
            );
            if (!existsSync(location)) return [];

            return new vscode.Location(
                vscode.Uri.file(location),
                new vscode.Position(0, 0)
            );
        }

        try {
            const response = await this.getImplementations(document, position);
            if (response.status !== 'ok') return;

            const links: vscode.LocationLink[] = response.implementations.map(impl => {
                return {
                    targetUri: vscode.Uri.file(impl.filename),
                    targetRange: new vscode.Range(
                        impl.line,
                        impl.column,
                        impl.line, impl.column + 3
                    )
                }
            });

            return links;
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    private getImplementations(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<ImplementationResponse> {
        return new Promise<ImplementationResponse>((res, rej) => {
            const config = vscode.workspace.getConfiguration('crystal-lang');
            const dir = vscode.workspace.getWorkspaceFolder(document.uri).name;
            const location = path.join(dir, path.basename(document.fileName));

            const child = spawn(
                config.get<string>('compiler'),
                [
                    'tool',
                    'implementations',
                    '-c',
                    `${location}:${position.line}:${position.character}`,
                    mainFile(undefined) || document.fileName,
                    '--no-color',
                    '-f',
                    'json'
                ]
            );

            const out: string[] = [];
            const err: string[] = [];

            child.stdout
                .setEncoding('utf-8')
                .on('data', d => out.push(d))
                .on('end', () => {
                    try {
                        res(JSON.parse(out.join()));
                    } catch {
                        rej('Failed to parse Crystal tool implementations response');
                    }
                });

            child.stderr
                .setEncoding('utf-8')
                .on('data', d => err.push(d))
                .on('end', () => rej(err.join()));
        });
    }
}