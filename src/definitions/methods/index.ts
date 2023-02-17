const PSEUDO = [
	[
		'is_a?',
		'is_a?',
		"The pseudo-method is_a? determines whether an expression's runtime type inherits or includes another type.",
	],
	[
		'nil?',
		'nil?',
		"The pseudo-method nil? determines whether an expression's runtime is Nil.",
	],
	[
		'responds_to?',
		'responds_to?',
		'The pseudo-method responds_to? determines whether a type has a method with the given name.',
	],
	['as', 'as', 'The as pseudo-method restricts the types of an expression.'],
	[
		'as?',
		'as?',
		"The as? pseudo-method is similar to as, except that it returns nil instead of raising an exception when the type doesn't match. It also can't be used to cast between pointer types and other types.",
	],
];

const OBJECT = [
	['==', '==(other)', 'Returns `true` if this object is equal to *other*.'],
	['!=', '!=(other)', 'Returns `true` if this object is not equal to *other*.'],
	['!~', '!~(other)', 'Shortcut to `!(self =~ other)`.'],
	['===', '===(other)', 'Case equality.'],
	['=~', '=~(other)', 'Pattern match.'],
	[
		'hash',
		'hash(other)',
		"Appends this object's value to *hasher*, and returns the modified *hasher*.",
	],
	['hash', 'hash', 'Generates an `UInt64` hash value for this object.'],
	['to_s', 'to_s : String', 'Returns a string representation of this object.'],
	[
		'to_s',
		'to_s(io : IO) : Nil',
		'Appends a `String` representation of this object to the given `IO` object.',
	],
	[
		'inspect',
		'inspect : String',
		'Returns a `String` representation of this object suitable to be embedded inside other expressions, sometimes providing more information about this object.',
	],
	[
		'inspect',
		'inspect(io : IO) : Nil',
		'Appends a string representation of this object to the given `IO` object.',
	],
	[
		'pretty_print',
		'pretty_print(pp : PrettyPrint) : Nil',
		'Pretty prints `self` into the given printer.',
	],
	[
		'pretty_inspect',
		'pretty_inspect(width = 79, newline = "\n", indent = 0) : String',
		'Returns a pretty printed version of `self`.',
	],
	['tap', 'tap', 'Yields `self` to the block, and then returns `self`.'],
	[
		'try',
		'try',
		"Yields `self`. `Nil` overrides this method and doesn't yield.",
	],
	[
		'in?',
		'in?(collection : Object) : Bool',
		'Returns `true` if `self` is included in the *collection* argument.',
	],
	[
		'in?',
		'in?(*values : Object) : Bool',
		'Returns `true` if `self` is included in the *collection* argument.',
	],
	['not_nil!', 'not_nil!', 'Returns `self`.'],
	['itself', 'itself', 'Returns `self`.'],
	['dup', 'dup', 'Returns a shallow copy (“duplicate”) of this object.'],
	[
		'unsafe_as',
		'unsafe_as(type : T.class) forall T',
		'Unsafely reinterprets the bytes of an object as being of another `type`.',
	],
];

const TOP_LEVEL = [
	[
		'`',
		'`(command) : String',
		'Returns the standard output of executing command in a subshell.',
	],
	[
		'abort',
		'abort(message, status = 1) : NoReturn',
		'Terminates execution immediately, printing message to STDERR and then calling exit(status).',
	],
	[
		'at_exit',
		'at_exit(&handler : Int32 -> ) : Nil',
		'Registers the given Proc for execution when the program exits.',
	],
	[
		'delay',
		'delay(delay, &block : -> _)',
		'Spawns a Fiber to compute &block in the background after delay has elapsed.',
	],
	[
		'exit',
		'exit(status = 0) : NoReturn',
		'Terminates execution immediately, returning the given status code to the invoking environment.',
	],
	['fork', 'fork', 'See also: Process.fork'],
	['fork', 'fork(&block)', 'See also: Process.fork'],
	[
		'future',
		'future(&exp : -> _)',
		'Spawns a Fiber to compute &block in the background.',
	],
	['gets', 'gets(*args, **options)', 'Reads a line from STDIN.'],
	[
		'lazy',
		'lazy(&block : -> _)',
		'Conditionally spawns a Fiber to run &block in the background.',
	],
	[
		'loop',
		'loop(&block)',
		'Repeatedly executes the block, passing an incremental Int32 that starts with 0.',
	],
	[
		'p',
		'p(*objects)',
		'Pretty prints each object in objects to STDOUT, followed by a newline.',
	],
	[
		'p',
		'p',
		'Pretty prints each object in objects to STDOUT, followed by a newline.',
	],
	['p', 'p(object)', 'Pretty prints object to STDOUT followed by a newline.'],
	[
		'print',
		'print(*objects : _) : Nil',
		'Prints objects to STDOUT and then invokes STDOUT.flush.',
	],
	[
		'printf',
		'printf(format_string, args : Array | Tuple) : Nil',
		'Prints a formatted string to STDOUT.',
	],
	[
		'printf',
		'printf(format_string, *args) : Nil',
		'Prints a formatted string to STDOUT.',
	],
	[
		'puts',
		'puts(*objects) : Nil',
		'Prints objects to STDOUT, each followed by a newline.',
	],
	['rand', 'rand(x)', 'See Random#rand(x).'],
	['rand', 'rand', 'See Random#rand.'],
	['read_line', 'read_line(*args, **options)', 'Reads a line from STDIN.'],
	['sleep', 'sleep', 'Blocks the current fiber forever.'],
	[
		'sleep',
		'sleep(time : Time::Span)',
		'Blocks the current Fiber for the specified time span.',
	],
	[
		'sleep',
		'sleep(seconds : Number)',
		'Blocks the current fiber for the specified number of seconds.',
	],
	['spawn', 'spawn(*, name : String? = nil, &block)', 'Spawns a new fiber.'],
	[
		'sprintf',
		'sprintf(format_string, *args) : String',
		'Returns a formatted string.',
	],
	[
		'sprintf',
		'sprintf(format_string, args : Array | Tuple) : String',
		'Returns a formatted string.',
	],
	[
		'system',
		'system(command : String, args = nil) : Bool',
		'Executes the given command in a subshell.',
	],
	[
		'pp',
		'pp(*exps)',
		'Prints a series of expressions together with their values.',
	],
	[
		'record',
		'record(name, *properties)',
		'Defines a Struct with the given name and properties.',
	],
	[
		'spawn',
		'spawn(call, *, name = nil)',
		"Spawns a fiber by first creating a Proc, passing the call's expressions to it, and letting the Proc finally invoke the call.",
	],
	['caller', 'caller', ''],
	['raise', 'raise(ex : Exception) : NoReturn', ''],
	['raise', 'raise(message : String) : NoReturn', ''],
	['with_color', 'with_color(color : Symbol)', ''],
	['with_color', 'with_color', ''],
	['assert_responds_to', 'assert_responds_to(var, method)', ''],
	['debugger', 'debugger', ''],
	['parallel', 'parallel(*jobs)', ''],
	['redefine_main', 'redefine_main(name = main)', ''],
];

export default {
	PSEUDO,
	OBJECT,
	TOP_LEVEL,
};
