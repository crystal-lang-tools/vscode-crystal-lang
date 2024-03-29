const CLASSES = [
	['ArgumentError', 'class ArgumentError'],
	['Array', 'class Array(T)'],
	['Box', 'class Box(T)'],
	['Channel', 'abstract class Channel(T)'],
	['CSV', 'class CSV'],
	['Deque', 'class Deque(T)'],
	['Dir', 'class Dir'],
	['DivisionByZero', 'class DivisionByZero'],
	['Errno', 'class Errno'],
	['Exception', 'class Exception'],
	['Fiber', 'class Fiber'],
	['File', 'class File'],
	['Hash', 'class Hash(K, V)'],
	['IndexError', 'class IndexError'],
	['INI', 'class INI'],
	['IPSocket', 'class IPSocket'],
	['KeyError', 'class KeyError'],
	['Log', 'class Log'],
	['Mutex', 'class Mutex'],
	['Object', 'abstract class Object'],
	['OptionParser', 'class OptionParser'],
	['PrettyPrint', 'class PrettyPrint'],
	['Process', 'class Process'],
	['Reference', 'class Reference'],
	['Regex', 'class Regex'],
	['Socket', 'class Socket'],
	['String', 'class String'],
	['StringPool', 'class StringPool'],
	['StringScanner', 'class StringScanner'],
	['TypeCastError', 'class TypeCastError'],
	['URI', 'class URI'],
	['Weakref', 'class WeakRef(T)'],
];

const MODULES = [
	['Base64', 'module Base64'],
	['Benchmark', 'module Benchmark'],
	['Colorize', 'module Colorize'],
	['Comparable', 'module Comparable(T)'],
	['Crypto', 'module Crypto'],
	['Crystal', 'module Crystal'],
	['Digest', 'module Digest'],
	['ECR', 'module ECR'],
	['Enumerable', 'module Enumerable(T)'],
	['FileUtils', 'module FileUtils'],
	['GC', 'module GC'],
	['HTML', 'module HTML'],
	['HTTP', 'module HTTP'],
	['Indexable', 'module Indexable(T)'],
	['IO', 'module IO'],
	['Iterable', 'module Iterable(T)'],
	['Iterator', 'module Iterator(T)'],
	['JSON', 'module JSON'],
	['Levenshtein', 'module Levenshtein'],
	['LLVM', 'module LLVM'],
	['Math', 'module Math'],
	['OAuth', 'module OAuth'],
	['OAuth2', 'module OAuth2'],
	['OpenSSL', 'module OpenSSL'],
	['Random', 'module Random'],
	['Spec', 'module Spec'],
	['System', 'module System'],
	['Termios', 'module Termios'],
	['Unicode', 'module Unicode'],
	['XML', 'module XML'],
	['YAML', 'module YAML'],
];

const OTHERS = [
	['Bytes', 'alias Bytes'],
	['Signal', 'enum Signal'],
];

const STRUCTS = [
	['Atomic', 'struct Atomic(T)'],
	['BigFloat', 'struct BigFloat'],
	['BigInt', 'struct BigInt'],
	['BigRational', 'struct BigRational'],
	['BitArray', 'struct BitArray'],
	['Bool', 'struct Bool'],
	['Char', 'struct Char'],
	['Complex', 'struct Complex'],
	['Enum', 'abstract struct Enum'],
	['Float', 'abstract struct Float'],
	['Float32', 'struct Float32'],
	['Float64', 'struct Float64'],
	['Int', 'abstract struct Int'],
	['Int8', 'struct Int8'],
	['Int16', 'struct Int16'],
	['Int32', 'struct Int32'],
	['Int64', 'struct Int64'],
	['Int128', 'struct Int128'],
	['NamedTuple', 'struct NamedTuple(**T)'],
	['Nil', 'struct Nil'],
	['Number', 'abstract struct Number'],
	['Pointer', 'struct Pointer(T)'],
	['Proc', 'struct Proc(*T, R)'],
	['Range', 'struct Range(B, E)'],
	['Set', 'struct Set(T)'],
	['Slice', 'struct Slice(T)'],
	['StaticArray', 'struct StaticArray(T, N)'],
	['Symbol', 'struct Symbol'],
	['Time', 'struct Time'],
	['Tuple', 'struct Tuple(*T)'],
	['UInt', 'struct UInt'],
	['UInt8', 'struct UInt8'],
	['UInt16', 'struct UInt16'],
	['UInt32', 'struct UInt32'],
	['UInt64', 'struct UInt64'],
	['UInt128', 'struct UInt128'],
	['Union', 'struct Union(*T)'],
	['Value', 'abstract struct Value'],
];

export default {
	CLASSES,
	MODULES,
	OTHERS,
	STRUCTS,
};
