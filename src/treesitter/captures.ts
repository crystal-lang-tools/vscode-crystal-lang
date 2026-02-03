/**
 * VSCode Semantic Token Types
 * These are the standard semantic token types supported by VSCode
 */
export const tokenTypes = [
  'namespace',
  'class',
  'enum',
  'interface',
  'struct',
  'typeParameter',
  'type',
  'parameter',
  'variable',
  'property',
  'enumMember',
  'decorator',
  'event',
  'function',
  'method',
  'macro',
  'label',
  'comment',
  'string',
  'keyword',
  'number',
  'regexp',
  'operator',
];

/**
 * VSCode Semantic Token Modifiers
 */
export const tokenModifiers = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'abstract',
  'async',
  'modification',
  'documentation',
  'defaultLibrary',
];

/**
 * Mapping from tree-sitter capture names to VSCode semantic token types
 * Based on the highlights.scm from tree-sitter-crystal
 */
interface TokenMapping {
  type: string;
  modifiers?: string[];
}

export const captureToTokenMap: Map<string, TokenMapping> = new Map([
  // Keywords
  ['keyword', { type: 'keyword' }],
  ['keyword.function', { type: 'keyword' }],
  ['keyword.type', { type: 'keyword' }],
  ['keyword.import', { type: 'keyword' }],
  ['keyword.return', { type: 'keyword' }],
  ['keyword.conditional', { type: 'keyword' }],
  ['keyword.conditional.ternary', { type: 'keyword' }],
  ['keyword.repeat', { type: 'keyword' }],
  ['keyword.exception', { type: 'keyword' }],
  ['keyword.modifier', { type: 'keyword' }],

  // Types
  ['type', { type: 'type' }],
  ['type.builtin', { type: 'type', modifiers: ['defaultLibrary'] }],
  ['type.definition', { type: 'type', modifiers: ['declaration'] }],

  // Functions and methods
  ['function', { type: 'function', modifiers: ['declaration'] }],
  ['function.method', { type: 'method', modifiers: ['declaration'] }],
  ['function.call', { type: 'function' }],
  ['method.call', { type: 'method' }],

  // Variables
  ['variable', { type: 'variable' }],
  ['variable.parameter', { type: 'parameter' }],
  ['variable.parameter.builtin', { type: 'parameter', modifiers: ['defaultLibrary'] }],
  ['variable.member', { type: 'property' }],
  ['variable.builtin', { type: 'variable', modifiers: ['defaultLibrary'] }],

  // Properties
  ['property', { type: 'property' }],

  // Constants
  ['constant', { type: 'variable', modifiers: ['readonly'] }],
  ['constant.builtin', { type: 'variable', modifiers: ['readonly', 'defaultLibrary'] }],

  // Literals
  ['string', { type: 'string' }],
  ['string.escape', { type: 'string' }],
  ['string.special', { type: 'string' }],
  ['string.special.symbol', { type: 'string' }],
  ['string.regexp', { type: 'regexp' }],
  ['character', { type: 'string' }],
  ['character.special', { type: 'string' }],
  ['number', { type: 'number' }],
  ['number.float', { type: 'number' }],
  ['boolean', { type: 'keyword' }],

  // Comments
  ['comment', { type: 'comment' }],

  // Operators
  ['operator', { type: 'operator' }],

  // Attributes/Annotations
  ['attribute', { type: 'decorator' }],

  // Labels (heredoc markers)
  ['label', { type: 'label' }],

  // Macros
  ['macro', { type: 'macro' }],

  // Punctuation (not mapped to semantic tokens in VSCode, but included for completeness)
  ['punctuation.delimiter', { type: 'operator' }],
  ['punctuation.bracket', { type: 'operator' }],
  ['punctuation.special', { type: 'operator' }],
  ['tag.delimiter', { type: 'operator' }],
]);

/**
 * Map a tree-sitter capture name to a VSCode semantic token type and modifiers
 */
export function mapCaptureToToken(captureName: string): TokenMapping | null {
  return captureToTokenMap.get(captureName) || null;
}

/**
 * Get the token type index from the token type name
 */
export function getTokenTypeIndex(typeName: string): number {
  return tokenTypes.indexOf(typeName);
}

/**
 * Get the token modifier bitmask from an array of modifier names
 */
export function getTokenModifierBitmask(modifierNames: string[]): number {
  let bitmask = 0;
  for (const modifier of modifierNames) {
    const index = tokenModifiers.indexOf(modifier);
    if (index >= 0) {
      bitmask |= (1 << index);
    }
  }
  return bitmask;
}
