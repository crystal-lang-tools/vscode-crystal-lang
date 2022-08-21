import * as vscode from 'vscode';
import * as TDATA from './crystalCompletionData';
import {
    CompletionResponse,
    getSymbols,
    isNotKeyword,
    spawnTools
} from './crystalUtils';

const TYPES = [
	TDATA.REFLECTION_METHODS,
    TDATA.NIL_METHODS,
    TDATA.BOOL_METHODS,
    TDATA.INT_METHODS,
	TDATA.FLOAT_METHODS,
    TDATA.CHAR_METHODS,
    TDATA.STRING_METHODS,
    TDATA.SYMBOLS_METHODS,
    TDATA.ARRAY_METHODS,
	TDATA.HASH_METHODS,
    TDATA.RANGE_METHODS,
    TDATA.REGEX_METHODS,
    TDATA.TUPLE_METHODS,
    TDATA.NAMEDTUPLE_METHODS,
	TDATA.PROC_METHODS,
    TDATA.FILE_METHODS,
    TDATA.DIR_METHODS,
    TDATA.CHANNEL_METHODS,
	TDATA.TOP_LEVEL_METHODS,
    TDATA.STRUCTS,
    TDATA.CLASSES,
    TDATA.MODULES,
    TDATA.ALIAS,
    TDATA.ENUMS
];

export class CrystalHoverProvider implements vscode.HoverProvider {
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover> {
        const config = vscode.workspace.getConfiguration('crystal-lang');
        if (!config.get<boolean>('hover')) return;

        const line = document.getText(new vscode.Range(
            new vscode.Position(position.line, 0),
            position
        ));
        if (!line || /^(?:".+|#(?!{).*)$/g.test(line)) return;

        const range = document.getWordRangeAtPosition(position);
        if (!range) return;

        const word = document.getText(range);
        if (!isNotKeyword(word)) return;

        try {
            const output = await spawnTools(document, position, 'context', 'hover');
            const response = <CompletionResponse> JSON.parse(output as string);

            console.log(response);
            if (response.status === 'ok') {
                for (let context of response.contexts) {
                    let type = context[word];
                    if (type) return new vscode.Hover({
                        language: 'crystal',
                        value: `${word} : ${type}`
                    });
                }
            }
        } catch (err) {
            console.error('ERROR: failed to parse JSON from Crystal context for hover');
        }

        const symbols = await getSymbols(document.uri);
        const markdown = new vscode.MarkdownString();
        for (let symbol of symbols) {
            if (symbol.name === word) {
                switch (symbol.kind) {
                    case 11:{
                        markdown.appendCodeblock(`def ${symbol.name}`, 'crystal');
                        let docs = this.getDocsForDefinition(document, position);
                        if (docs) markdown.appendMarkdown(docs);
                        break;
                    // case 12:
                    // case 13:
                    //     value = text;
                    //     break;
                    }
                    default:{
                        markdown.appendCodeblock(
                            `${vscode.SymbolKind[symbol.kind].toLowerCase()} ${symbol.name}`,
                            'crystal'
                        );
                        let docs = this.getDocsForDefinition(document, position);
                        if (docs) markdown.appendMarkdown(docs);
                        break;
                    }
                }
                return new vscode.Hover(markdown);
            }
        }

        const definitions: [string, string][] = [];
        for (let type of TYPES) {
            for (let comp of type) {
                if (comp[0] !== word) continue;
                if (comp[0] === word) definitions.push([comp[1], comp[2]]);
            }
        }

        const filtered: string[] = [];
        for (let def of definitions) {
            if (!def[1]) continue;
            if (filtered.includes(def[1])) continue;

            filtered.push(def[1]);
            markdown.appendCodeblock(def[0]);
            markdown.appendMarkdown(def[1]);
        }
        if (!markdown.value.length) return;

        return new vscode.Hover(markdown);
    }

    private getDocsForDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): string {
        const docs: string[] = [];
        let current = position.line;

        while (true) {
            if (current < 0) break;
            console.log(`line: ${current}`);
            let line = document.lineAt(current);
            if (!line) break;

            let text = line.text.trimLeft();
            if (!text.startsWith('#')) break;

            docs.push(text.slice(1));
            current--;
        }

        return docs.reverse().join('\n');
    }
}
