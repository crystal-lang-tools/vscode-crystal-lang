import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import * as fs from 'fs';
import * as path from 'path';
import {
  tokenTypes,
  tokenModifiers,
  mapCaptureToToken,
  getTokenTypeIndex,
  getTokenModifierBitmask,
} from './captures';
import { parseDocument, parseDocumentIncremental } from './parser';

export const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

interface CachedTree {
  version: number;
  tree: Parser.Tree;
}

/**
 * Semantic token provider using tree-sitter
 */
export class CrystalSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  private trees: Map<string, CachedTree> = new Map();
  private query: Parser.Query | null = null;
  private language: Parser.Language | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext
  ) {}

  /**
   * Initialize the tree-sitter query from highlights.scm
   */
  async initialize(language: Parser.Language): Promise<void> {
    this.language = language;

    // Load the highlights query
    const queryPath = path.join(this.context.extensionPath, 'queries', 'highlights.scm');
    console.log('[Crystal Tree-sitter] Loading query from:', queryPath);
    const querySource = fs.readFileSync(queryPath, 'utf8');

    try {
      this.query = new Parser.Query(language, querySource);
      console.log('[Crystal Tree-sitter] Query loaded successfully');
    } catch (error) {
      console.error('[Crystal Tree-sitter] Error loading query:', error);
      console.error('[Crystal Tree-sitter] Query path:', queryPath);
      console.error('[Crystal Tree-sitter] Query source length:', querySource.length);
      vscode.window.showErrorMessage(`Failed to load Crystal syntax highlighting query: ${error}`);
      throw error;
    }
  }

  /**
   * Provide semantic tokens for a document
   */
  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens | null> {
    if (!this.query || token.isCancellationRequested) {
      return null;
    }

    // Parse the document
    const tree = parseDocument(document);
    if (!tree) {
      return null;
    }

    // Cache the tree for incremental updates
    this.trees.set(document.uri.toString(), {
      version: document.version,
      tree,
    });

    // Build semantic tokens
    const builder = new vscode.SemanticTokensBuilder(legend);
    this.collectTokens(tree, builder, document);

    return builder.build();
  }

  /**
   * Collect semantic tokens from a tree-sitter tree using queries
   */
  private collectTokens(
    tree: Parser.Tree,
    builder: vscode.SemanticTokensBuilder,
    document: vscode.TextDocument
  ): void {
    if (!this.query) {
      return;
    }

    // Execute the query to get captures
    const captures = this.query.captures(tree.rootNode);

    // Process each capture
    for (const capture of captures) {
      const { name, node } = capture;

      // Map the capture name to a token type
      const tokenMapping = mapCaptureToToken(name);
      if (!tokenMapping) {
        continue;
      }

      const tokenTypeIndex = getTokenTypeIndex(tokenMapping.type);
      if (tokenTypeIndex < 0) {
        continue;
      }

      const modifierBitmask = getTokenModifierBitmask(tokenMapping.modifiers || []);

      // Get the range of the node
      const startPos = new vscode.Position(node.startPosition.row, node.startPosition.column);
      const endPos = new vscode.Position(node.endPosition.row, node.endPosition.column);

      // Skip multi-line tokens for now (VSCode limitation)
      if (startPos.line !== endPos.line) {
        // For multi-line nodes, we could tokenize each line separately
        // but for now we skip them to keep it simple
        continue;
      }

      const range = new vscode.Range(startPos, endPos);

      // Add the token
      builder.push(range, tokenMapping.type, tokenMapping.modifiers || []);
    }
  }

  /**
   * Update tokens when document changes (for better performance)
   */
  async provideDocumentSemanticTokensEdits(
    document: vscode.TextDocument,
    previousResultId: string,
    token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens | vscode.SemanticTokensEdits | null> {
    // For now, just provide full tokens
    // We could implement incremental updates here in the future
    return this.provideDocumentSemanticTokens(document, token);
  }

  /**
   * Clean up cached tree when document is closed
   */
  cleanupDocument(uri: string): void {
    const cached = this.trees.get(uri);
    if (cached) {
      cached.tree.delete();
      this.trees.delete(uri);
    }
  }
}

/**
 * Register the semantic token provider
 */
export function registerSemanticTokensProvider(
  context: vscode.ExtensionContext,
  language: Parser.Language
): void {
  const provider = new CrystalSemanticTokensProvider(context);

  // Initialize the provider with the query
  provider.initialize(language).catch(error => {
    console.error('Failed to initialize semantic tokens provider:', error);
  });

  // Register for Crystal files
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'crystal', scheme: 'file' },
      provider,
      legend
    )
  );

  // Clean up trees when documents are closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.languageId === 'crystal') {
        provider.cleanupDocument(doc.uri.toString());
      }
    })
  );
}
