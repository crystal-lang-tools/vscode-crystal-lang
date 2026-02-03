; Early rules
; These patterns may be overridden later

[
  ","
  ";"
  "."
  ":"
] @punctuation.delimiter

; Keywords

[
  "alias"
  "annotation"
  "asm"
  "begin"
  "break"
  "case"
  "do"
  "end"
  "ensure"
  "extend"
  "in"
  "include"
  "next"
  "of"
  "select"
  "then"
  "verbatim"
  "when"
] @keyword

[
  "def"
  "fun"
  "macro"
] @keyword.function

[
  "class"
  "enum"
  "lib"
  "module"
  "struct"
  "type"
  "union"
] @keyword.type

"require" @keyword.import

[
  "return"
  "yield"
] @keyword.return

[
  "if"
  "else"
  "elsif"
  "unless"
] @keyword.conditional

(conditional
  [
    "?"
    ":"
  ] @keyword.conditional.ternary)

[
  "for"
  "until"
  "while"
] @keyword.repeat

"rescue" @keyword.exception

[
  (private)
  (protected)
  "abstract"
] @keyword.modifier

(pseudo_constant) @constant.builtin

; literals
(string
  "\"" @string)

(string
  (literal_content) @string)

(string
  (escape_sequence) @string.escape)

(symbol
  [
    ":"
    ":\""
    "\""
  ] @string.special.symbol)

(symbol
  (literal_content) @string.special.symbol)

(symbol
  (escape_sequence) @character)

(command
  "`" @string.special)

(command
  (literal_content) @string.special)

(command
  (escape_sequence) @character)

(regex
  "/" @punctuation.bracket)

(regex
  (literal_content) @string.regexp)

(regex_modifier) @character.special

(heredoc_body
  (literal_content) @string)

(heredoc_body
  (escape_sequence) @string.escape)

[
  (heredoc_start)
  (heredoc_end)
] @label

(char
  "'" @character)

(char
  (literal_content) @character)

(char
  (escape_sequence) @string.escape)

(integer) @number

(float) @number.float

[
  (true)
  (false)
] @boolean

(nil) @constant.builtin

((comment) @comment
  ; Set priority so macro expressions in comments are not grayed out
  (#set! priority 95))

; Operators and punctuation
[
  "="
  "=>"
  "->"
  "&"
  "*"
  "**"
  (operator)
] @operator

[
  "("
  ")"
  "["
  "@["
  "]"
  "{"
  "}"
] @punctuation.bracket

([
  "{{"
  "}}"
] @punctuation.bracket
  ; Set priority so "a{{b}}" is highlighted as brackets, not string content
  ;                   ^^
  (#set! priority 105))

(index_call
  method: (operator) @punctuation.bracket
  [
    "]"
    "]?"
  ] @punctuation.bracket)

(block
  "|" @punctuation.bracket)

[
  "{%"
  "%}"
] @tag.delimiter

(interpolation
  "#{" @punctuation.special
  "}" @punctuation.special)

; Types
[
  (constant)
  (generic_instance_type)
  (generic_type)
] @type

(nilable_constant
  "?" @type.builtin)

(nilable_type
  "?" @type.builtin)

(union_type
  "|" @operator)

(annotation
  (constant) @attribute)

; Type definitions - highlight the type name on definition
(class_def
  name: (constant) @type.definition)

(class_def
  name: (generic_type
    (constant) @type.definition))

(module_def
  name: (constant) @type.definition)

(struct_def
  name: (constant) @type.definition)

(struct_def
  name: (generic_type
    (constant) @type.definition))

(enum_def
  name: (constant) @type.definition)

(lib_def
  name: (constant) @type.definition)

(union_def
  name: (constant) @type.definition)

(alias_def
  name: (constant) @type.definition)

(annotation_def
  name: (constant) @type.definition)

; Constant assignments
(const_assign
  name: (constant) @constant)

; Global variables
(global_var) @variable.builtin

(method_def
  name: (identifier) @function.method)

(macro_def
  name: (identifier) @macro)

(abstract_method_def
  name: (identifier) @function.method)

(fun_def
  name: (identifier) @function
  real_name: (identifier)? @function)

(param
  name: (identifier) @variable.parameter)

(splat_param
  name: (identifier) @variable.parameter)

(double_splat_param
  name: (identifier) @variable.parameter)

(block_param
  name: (identifier) @variable.parameter)

(fun_param
  name: (identifier) @variable.parameter)

(rescue
  variable: (identifier) @variable.parameter)

(macro_var
  name: (identifier) @variable)

[
  (class_var)
  (instance_var)
] @variable.member

(underscore) @variable.parameter.builtin

(self) @variable.builtin

(named_tuple
  (named_expr
    name: (identifier) @property))

(argument_list
  (named_expr
    name: (identifier) @property))

(named_type
  name: (identifier) @property)

; Method calls (with receiver like obj.method())
(implicit_object_call
  method: (identifier) @method.call)

; Function calls (standalone like foo())
(call
  method: (identifier) @function.call)
