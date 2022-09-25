import * as path from 'path';
import { existsSync } from 'fs';
import {
    CancellationToken,
    Definition,
    DocumentSelector,
    ExtensionContext,
    ImplementationProvider,
    languages,
    Location,
    LocationLink,
    Position,
    TextDocument,
    Uri,
    workspace
} from 'vscode';
import { spawnImplTool } from './tools';

class CrystalImplementationProvider implements ImplementationProvider {
    async provideImplementation(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<LocationLink[] | Definition> {
        const line = document.lineAt(position.line);
        const matches = /^require\s+"(.+)"\s*$/.exec(line.text);

        if (matches.length) {
            const dir = path.dirname(document.fileName);
            let text = matches[1];
            
            if (/^\.{1,2}\/.+/.test(text)) {
                if (!text.endsWith('.cr')) text += '.cr';
                const loc = path.join(dir, text);
                if (!existsSync(loc)) return [];

                return new Location(Uri.file(loc), new Position(0, 0));
            }

            // TODO: implement shard lookup
            return [];
        }

        try {
            const res = await spawnImplTool(document, position);
            console.log(res);
            if (res.status === 'failed') {
                console.error(res.message);
                return [];
            }

            const links: Location[] = [];
            for (let impl of res.implementations!) {
                links.push(
                    new Location(Uri.file(impl.filename),
                    new Position(impl.line, impl.column))
                );
            }

            return links;
        } catch (err) {
            console.error(`implementations: ${err}`);
            return [];
        }
    }
}

export function registerImplementations(selector: DocumentSelector, context: ExtensionContext): void {
    context.subscriptions.push(
        languages.registerImplementationProvider(selector, new CrystalImplementationProvider())
    );
}
