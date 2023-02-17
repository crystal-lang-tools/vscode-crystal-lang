import { existsSync } from 'fs';
import * as path from 'path';
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

		if (matches?.length > 1) {
			let text = matches[1];
			if (text.includes('*')) return [];
			const dir = path.dirname(document.fileName);
			console.debug(`[Implementations] identified: ${text}`);

			if (/^\.{1,2}\/\w+/.test(text)) {
				if (!text.endsWith('.cr')) text += '.cr';
				const loc = path.join(dir, text);
				if (!existsSync(loc)) return [];

				return new Location(Uri.file(loc), new Position(0, 0));
			}

			// TODO: implement shard lookup
			return [];
		}

		try {
			console.debug('[Implementations] getting implementations...');
			const res = await spawnImplTool(document, position);
			if (res.status !== 'ok') {
				console.debug(`[Implementations] failed: ${res}`);
				return [];
			}

			const links: Location[] = [];
			for (let impl of res.implementations!) {
				links.push(
					new Location(
						Uri.file(impl.filename),
						new Position(impl.line, impl.column)
					)
				);
			}

			return links;
		} catch (err) {
			console.debug(`[Implementations] failed: ${err}`);
			return [];
		}
	}
}

export function registerImplementations(
	selector: DocumentSelector,
	context: ExtensionContext
): void {
	context.subscriptions.push(
		languages.registerImplementationProvider(
			selector,
			new CrystalImplementationProvider()
		)
	);
}
