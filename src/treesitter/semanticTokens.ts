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
  private documentChanges: Map<string, vscode.TextDocumentContentChangeEvent[]> = new Map();
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
    const querySource = fs.readFileSync(queryPath, 'utf8');

    try {
      this.query = new Parser.Query(language, querySource);
    } catch (error) {
      console.error('[Crystal Tree-sitter] Error loading query:', error);
      vscode.window.showErrorMessage(`Failed to load Crystal syntax highlighting query: ${error}`);
      throw error;
    }
  }

  /**
   * Track document changes for incremental parsing
   */
  onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (event.document.languageId !== 'crystal') {
      return;
    }

    const uri = event.document.uri.toString();
    const cached = this.trees.get(uri);

    // Only track changes if we have a cached tree for this document
    if (cached && event.contentChanges.length > 0) {
      const changes = this.documentChanges.get(uri) || [];
      changes.push(...event.contentChanges);
      this.documentChanges.set(uri, changes);
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

    const uri = document.uri.toString();
    const cached = this.trees.get(uri);
    const changes = this.documentChanges.get(uri);

    let tree: Parser.Tree | null = null;

    // Use incremental parsing if we have a cached tree and changes
    if (cached && changes && changes.length > 0 && cached.version < document.version) {
      tree = parseDocumentIncremental(document, cached.tree, changes);
      // Clear the changes after applying them
      this.documentChanges.delete(uri);
    }

    // Fall back to full parse if incremental parsing failed or not applicable
    if (!tree) {
      tree = parseDocument(document);
    }

    if (!tree) {
      return null;
    }

    // Cache the tree for future incremental updates
    this.trees.set(uri, {
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

    // Process each capture with error handling
    for (const capture of captures) {
      try {
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

        // Skip multi-line tokens - VSCode's semantic token API works best with single-line tokens
        // Multi-line constructs (heredocs, multi-line strings, comments) are still highlighted
        // by the base TextMate grammar
        if (startPos.line !== endPos.line) {
          continue;
        }

        const range = new vscode.Range(startPos, endPos);

        // Add the token
        builder.push(range, tokenMapping.type, tokenMapping.modifiers || []);
      } catch (error) {
        // Log and continue to avoid breaking all highlighting on a single capture error
        console.error('[Crystal Tree-sitter] Error processing capture:', error);
        continue;
      }
    }
  }

  /**
   * Clean up cached tree and changes when document is closed
   */
  cleanupDocument(uri: string): void {
    const cached = this.trees.get(uri);
    if (cached) {
      cached.tree.delete();
      this.trees.delete(uri);
    }
    this.documentChanges.delete(uri);
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

  // Track document changes for incremental parsing
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      provider.onDocumentChange(event);
    })
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
