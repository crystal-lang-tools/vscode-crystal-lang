import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Track what exec receives so we can return the right mock response
let execMockImpl: (cmd: string, opts: any, cb: Function) => any;

// Mock child_process.exec to control crystal tool output
vi.mock('child_process', () => ({
	exec: vi.fn((cmd: string, opts: any, cb: Function) => {
		if (execMockImpl) return execMockImpl(cmd, opts, cb);
		cb(null, '', '');
		return {};
	}),
}));

// Mock vscode module
vi.mock('vscode', () => {
	const Uri = {
		file: (p: string) => ({ fsPath: p }),
		parse: (p: string) => ({ fsPath: p }),
	};

	return {
		Uri,
		workspace: {
			getWorkspaceFolder: vi.fn(),
			getConfiguration: vi.fn(() => ({
				get: vi.fn((key: string) => {
					if (key === 'flags') return '';
					return undefined;
				}),
				has: vi.fn(() => false),
			})),
			createFileSystemWatcher: vi.fn(),
			openTextDocument: vi.fn(() => Promise.resolve({})),
		},
		window: {
			createOutputChannel: vi.fn(() => ({
				appendLine: vi.fn(),
				show: vi.fn(),
			})),
			setStatusBarMessage: vi.fn(() => ({ dispose: vi.fn() })),
		},
		languages: {
			createDiagnosticCollection: vi.fn(() => ({
				set: vi.fn(),
				clear: vi.fn(),
				delete: vi.fn(),
			})),
		},
		Position: class {
			constructor(public line: number, public character: number) { }
		},
		Range: class {
			constructor(
				public startLine: number,
				public startChar: number,
				public endLine: number,
				public endChar: number
			) { }
		},
		DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
		Diagnostic: class {
			constructor(public range: any, public message: string, public severity: number) { }
		},
	};
});

// Mock fs
vi.mock('fs', async () => {
	const actual = await vi.importActual<typeof import('fs')>('fs');
	return {
		...actual,
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ''),
	};
});

import { existsSync, readFileSync } from 'fs';
import { workspace } from 'vscode';
import * as tools from './tools';

describe('getShardTargetForFile', () => {
	const workspacePath = '/home/user/myproject';
	const mainFile = 'src/main.cr';
	const mainFilePath = path.resolve(workspacePath, mainFile);
	const depFile = 'src/helper.cr';
	const depFilePath = path.resolve(workspacePath, depFile);

	function makeDocument(filePath: string) {
		return {
			uri: { fsPath: filePath },
			fileName: filePath,
		} as any;
	}

	function makeWorkspaceFolder(dirPath: string) {
		return {
			name: path.basename(dirPath),
			uri: { fsPath: dirPath },
			index: 0,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		execMockImpl = undefined as any;

		vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(
			makeWorkspaceFolder(workspacePath) as any
		);

		vi.mocked(existsSync).mockReturnValue(true);

		// Default exec mock: getCompilerPath calls `which crystal`
		execMockImpl = (cmd: string, _opts: any, cb: Function) => {
			if (cmd.includes('which crystal')) {
				cb(null, '/usr/bin/crystal\n', '');
			} else if (cmd.includes('tool dependencies')) {
				// Default: return empty dependency list
				cb(null, '', '');
			} else {
				cb(null, '', '');
			}
			return {};
		};
	});

	it('returns the target path immediately when the document IS the main target file', async () => {
		vi.mocked(readFileSync).mockReturnValue(`
name: myproject
version: 0.1.0
targets:
  myproject:
    main: ${mainFile}
`);

		const doc = makeDocument(mainFilePath);
		const result = await tools.getShardTargetForFile(doc);

		// With the bugfix, the main file is detected before running dependencies
		expect(result).toEqual({
			response: mainFilePath,
			error: undefined,
		});
	});

	it('returns the target path when the document is a dependency of the target', async () => {
		vi.mocked(readFileSync).mockReturnValue(`
name: myproject
version: 0.1.0
targets:
  myproject:
    main: ${mainFile}
`);

		execMockImpl = (cmd: string, _opts: any, cb: Function) => {
			if (cmd.includes('which crystal')) {
				cb(null, '/usr/bin/crystal\n', '');
			} else if (cmd.includes('tool dependencies')) {
				cb(null, `${depFile}\n`, '');
			} else {
				cb(null, '', '');
			}
			return {};
		};

		const doc = makeDocument(depFilePath);
		const result = await tools.getShardTargetForFile(doc);

		expect(result).toEqual({
			response: mainFilePath,
			error: undefined,
		});
	});

	it('returns error when the document is not a dependency of any target', async () => {
		vi.mocked(readFileSync).mockReturnValue(`
name: myproject
version: 0.1.0
targets:
  myproject:
    main: ${mainFile}
`);

		execMockImpl = (cmd: string, _opts: any, cb: Function) => {
			if (cmd.includes('which crystal')) {
				cb(null, '/usr/bin/crystal\n', '');
			} else if (cmd.includes('tool dependencies')) {
				cb(null, 'src/other.cr\n', '');
			} else {
				cb(null, '', '');
			}
			return {};
		};

		const unrelatedFile = path.resolve(workspacePath, 'src/unrelated.cr');
		const doc = makeDocument(unrelatedFile);
		const result = await tools.getShardTargetForFile(doc);

		expect(result).toEqual({
			response: undefined,
			error: true,
		});
	});

	it('returns error when shard.yml has no targets', async () => {
		vi.mocked(readFileSync).mockReturnValue(`
name: myproject
version: 0.1.0
`);

		const doc = makeDocument(mainFilePath);
		const result = await tools.getShardTargetForFile(doc);

		expect(result).toEqual({
			response: undefined,
			error: true,
		});
	});

	it('skips targets whose files do not exist on disk', async () => {
		vi.mocked(readFileSync).mockReturnValue(`
name: myproject
version: 0.1.0
targets:
  myproject:
    main: src/missing.cr
`);

		vi.mocked(existsSync).mockImplementation((p: any) => {
			if (typeof p === 'string' && p.endsWith('shard.yml')) return true;
			if (typeof p === 'string' && p.endsWith('missing.cr')) return false;
			return true;
		});

		const doc = makeDocument(mainFilePath);
		const result = await tools.getShardTargetForFile(doc);

		expect(result).toEqual({
			response: undefined,
			error: true,
		});
	});
});
