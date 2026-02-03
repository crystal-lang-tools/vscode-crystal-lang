import * as Parser from 'web-tree-sitter';
import * as path from 'path';
import * as vscode from 'vscode';

let parserInitialized = false;
let crystalParser: Parser.Parser | null = null;
let crystalLanguage: Parser.Language | null = null;

/**
 * Initialize tree-sitter and load the Crystal language grammar
 */
export async function initializeParser(context: vscode.ExtensionContext): Promise<Parser.Parser> {
  if (crystalParser && crystalLanguage) {
    return crystalParser;
  }

  if (!parserInitialized) {
    // Initialize tree-sitter WASM runtime
    const wasmPath = path.join(context.extensionPath, 'parsers', 'web-tree-sitter.wasm');

    await Parser.Parser.init({
      locateFile(_file: string, _folder: string) {
        return wasmPath;
      }
    });
    parserInitialized = true;
  }

  // Load Crystal language grammar
  const crystalWasmPath = path.join(context.extensionPath, 'parsers', 'tree-sitter-crystal.wasm');

  crystalLanguage = await Parser.Language.load(crystalWasmPath);

  // Create parser instance
  crystalParser = new Parser.Parser();
  crystalParser.setLanguage(crystalLanguage);

  return crystalParser;
}

/**
 * Get the initialized parser (throws if not initialized)
 */
export function getParser(): Parser.Parser {
  if (!crystalParser) {
    throw new Error('Parser not initialized. Call initializeParser first.');
  }
  return crystalParser;
}

/**
 * Parse a document with the Crystal parser
 */
export function parseDocument(document: vscode.TextDocument): Parser.Tree | null {
  const parser = getParser();
  try {
    return parser.parse(document.getText());
  } catch (error) {
    console.error('Error parsing document:', error);
    return null;
  }
}

/**
 * Apply incremental edits to a tree for better performance
 */
export function parseDocumentIncremental(
  document: vscode.TextDocument,
  previousTree: Parser.Tree,
  changes: readonly vscode.TextDocumentContentChangeEvent[]
): Parser.Tree | null {
  const parser = getParser();

  try {
    // Apply edits to the tree
    for (const change of changes) {
      const startIndex = change.rangeOffset;
      const oldEndIndex = change.rangeOffset + change.rangeLength;
      const newEndIndex = change.rangeOffset + change.text.length;

      const startPos = document.positionAt(startIndex);
      const oldEndPos = document.positionAt(oldEndIndex);
      const newEndPos = document.positionAt(newEndIndex);

      previousTree.edit({
        startIndex,
        oldEndIndex,
        newEndIndex,
        startPosition: { row: startPos.line, column: startPos.character },
        oldEndPosition: { row: oldEndPos.line, column: oldEndPos.character },
        newEndPosition: { row: newEndPos.line, column: newEndPos.character },
      });
    }

    // Reparse with the edited tree
    return parser.parse(document.getText(), previousTree);
  } catch (error) {
    console.error('Error during incremental parsing:', error);
    return null;
  }
}
