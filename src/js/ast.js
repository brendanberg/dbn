import * as Op from './opcodes';
import assemble from './assemble';
import emitBuiltins from './builtins';

let currentSymbol = 0;

const AST = {

	tools: {
		toCanonicalName: function(name) {
			const map = {
				'load': 'Load',
				'paper': 'Paper',
				'pen': 'Pen',
				'line': 'Line',
				'set': 'Set',
				'value': 'Value',
				'repeat': 'Repeat',
				'forever': 'Forever',
				'same?': 'Same?',
				'notsame?': 'NotSame?',
				'smaller?': 'Smaller?',
				'notsmaller?': 'NotSmaller?',
				'command': 'Command',
				'number': 'Number',
				'pause': 'Pause',
				'refresh': 'Refresh',
				'mouse': 'Mouse',
				'key': 'Key',
				'time': 'Time',
				'net': 'Net',
				'array': 'Array',
				'abs': 'Abs'
			};
			let lower = name.toLowerCase();

			if (lower in map) {
				return map[lower];
			} else {
				return lower;
			}
		},
		gensym: function() {
			return '$_AST_JS_' + (currentSymbol++).toString(36).toUpperCase();
		}
	},

	reservedWords: [
		'Load',
		'Paper',
		'Pen',
		'Line',
		'Set',
		'Value',
		'Repeat',
		'Forever',
		'Same?',
		'NotSame?',
		'Smaller?',
		'NotSmaller?',
		'Command',
		'Number',
		'Pause'
	],

	controlFlow: {
		'Repeat': function(stmnt, body) {
			var name = stmnt.args[0],
				start = stmnt.args[1],
				stop = stmnt.args[2];

			if (!name) {
				throw {
					message: '"Repeat" expects a variable name as the first parameter',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (!(start && stop)) {
				throw {
					message: '"Repeat" requires both start and end values',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (name.meta.type !== 'identifier') {
				throw {
					message: '"Repeat" expects a variable name as the first parameter',
					start: name.meta.start,
					end: name.meta.end
				};
			} else  if (stmnt.args.length > 3) {
				throw {
					message: '"Repeat" expects only three parameters',
					start: stmnt.args[3].meta.start,
					end: stmnt.args[stmnt.args.length - 1].meta.end
				};
			}

			return new AST.Loop(name, start, stop, body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'Forever': function(forever, body) {
			if (forever.args.length) {
				throw {
					message: '"Forever" must be followed by a new line',
					start: forever.meta.start,
					end: forever.meta.end
				};
			}

			return new AST.Loop(null, null, null, body.statements, {
				start: forever.meta.start,
				end: body.meta.end
			});
		},
		'Same?': function(stmnt, body) {
			if (stmnt.args.length !== 2) {
				throw {
					message: '"' + stmnt.canonical + '" requires two values to compare',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			}

			var predicate = new AST.Equals(stmnt.args[0], stmnt.args[1], {
				start: stmnt.meta.start,
				end: stmnt.meta.end
			});

			return new AST.Condition(predicate, body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'NotSame?': function(stmnt, body) {
			if (stmnt.args.length !== 2) {
				throw {
					message: '"' + stmnt.canonical + '" requires two values to compare',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			}

			var predicate = new AST.Equals(stmnt.args[0], stmnt.args[1], {
				start: stmnt.meta.start,
				end: stmnt.meta.end
			});

			return new AST.Condition(new AST.Not(predicate), body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'Smaller?': function(stmnt, body) {
			if (stmnt.args.length !== 2) {
				throw {
					message: '"' + stmnt.canonical + '" requires two values to compare',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			}

			var predicate = new AST.LessThan(stmnt.args[0], stmnt.args[1], {
				start: stmnt.meta.start,
				end: stmnt.meta.end
			});

			return new AST.Condition(predicate, body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'NotSmaller?': function(stmnt, body) {
			if (stmnt.args.length !== 2) {
				throw {
					message: '"' + stmnt.canonical + '" requires two values to compare',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			}

			var predicate = new AST.LessThan(stmnt.args[0], stmnt.args[1], {
				start: stmnt.meta.start,
				end: stmnt.meta.end
			});

			return new AST.Condition(new AST.Not(predicate), body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'Command': function(stmnt, body) {
			if (stmnt.args.length < 1) {
				throw {
					message: '"Command" requires a name as the first parameter',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (stmnt.args[0].meta.type !== 'identifier') {
				throw {
					message: '"Command" requires a name as the first parameter',
					start: stmnt.args[0].meta.start,
					end: stmnt.args[0].meta.end
				};
			} else if (stmnt.args.slice(1).filter(x => x.meta.type !== 'identifier').length) {
				throw {
					message: 'additional parameters to "Command" must be variable names',
					start: stmnt.args[1].meta.start,
					end: stmnt.args[stmnt.args.length - 1].meta.end
				}
			}

			return new AST.Command(stmnt.args[0], stmnt.args.slice(1), body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'Number': function(stmnt, body) {
			// TODO: Disallow side effects.
			if (stmnt.args.length < 1) {
				throw {
					message: '"Number" requires a name as the first parameter',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (stmnt.args[0].meta.type !== 'identifier') {
				throw {
					message: '"Number" requires a name as the first parameter',
					start: stmnt.args[0].meta.start,
					end: stmnt.args[0].meta.end
				};
			} else if (stmnt.args.slice(1).filter(x => x.meta.type !== 'identifier').length) {
				throw {
					message: 'additional parameters to "Number" must be variable names',
					start: stmnt.args[1].meta.start,
					end: stmnt.args[stmnt.args.length - 1].meta.end
				}
			}

			return new AST.Number(stmnt.args[0], stmnt.args.slice(1), body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
	},

	connectors: {
		'Mouse': {arity: [1], unbound: []},
		'Key': {arity: [1], unbound: []},
		'Time': {arity: [1], unbound: []},
		'Net': {arity: [1], unbound: []},
		'Array': {arity: [1], unbound: []},
		'Abs': {arity: [1], unbound: []}
	},
	
	commands: {
		'Paper': {arity: [1, 3], unbound: []},
		'Pen': {arity: [1, 3], unbound: []},
		'Set': {arity: [2], unbound: []},
		'Line': {arity: [4], unbound: []},
		'Field': {arity: [5], unbound: []},
		'Value': {arity: [1], unbound: []},
		'Pause': {arity: [1], unbound: []}
	},

	Program: function (statements, meta) {
		this.meta = Object.assign({
				type: 'program',
				locals: [],
				// IMPORTANT! There shouldn't actually be unbound or args on
				// a program. These properties are here so transforms don't fail
				unbound: [],
			}, meta || {});

		//this.defns = [];
		//this.outerDefns = [];
		this.args = [];
		this.statements = statements;
		this.definitions = [];
		this.exports = [];
	},

	Block: function(statements, meta) {
		this.meta = Object.assign({type: 'block'}, meta || {});

		//this.defns = [];
		this.outerDefns = [];
		this.statements = statements;
		this.comment = null;
	},

	Loop: function(name, start, stop, statements, meta) {
		// TODO: Ensure start and stop are scalar value types.
		this.meta = Object.assign({type: 'loop', inner: true}, meta || {});
		this.iterator = name;
		this.start = start;
		this.stop = stop;
		this.statements = statements;
	},

	Condition: function(predicate, statements, meta) {
		this.meta = Object.assign({type: 'condition'}, meta || {});
		this.predicate = predicate;
		this.statements = statements;
	},

	Not: function(expression, meta) {
		this.meta = Object.assign({type: 'not'}, meta || {});
		this.expression = expression;
	},

	LessThan: function(lhs, rhs, meta) {
		this.meta = Object.assign({type: 'lessthan'}, meta || {});
		this.lhs = lhs;
		this.rhs = rhs;
	},

	Equals: function(lhs, rhs, meta) {
		this.meta = Object.assign({type: 'equals'}, meta || {});
		this.lhs = lhs;
		this.rhs = rhs;
	},

	Command: function(name, idents, statements, meta) {
		this.meta = Object.assign({
				type: 'command',
				unbound: [],
				locals: [],
				args: []
			}, meta || {});
		this.name = name;
		//this.defns = [];
		//this.outerDefns = [];
		this.args = idents.map(x => {
			x.meta.argument = true;
			return x;
		});
		this.statements = statements;
		this.definitions = [];
	},

	Number: function(name, idents, statements, meta) {
		this.meta = Object.assign({
				type: 'number',
				unbound: [],
				locals: []
			}, meta || {});
		this.name = name;
		//this.defns = [];
		//this.outerDefns = [];
		this.args = idents.map(x => {
			x.meta.argument = true;
			return x;
		});
		this.statements = statements;
		this.definitions = [];
	},

	Statement: function(name, args, meta) {
		this.meta = Object.assign({type: 'statement'}, meta || {});
		this.name = name.name;
		this.canonical = name.canonical;
		this.args = args;
		this.comment = null;
	},

	Generator: function (name, args, meta) {
		this.meta = Object.assign({type: 'connector', lvalue: false}, meta || {});

		this.name = name;
		this.canonical = AST.tools.toCanonicalName(name);
		this.args = args;
	},

	Identifier: function(name, meta) {
		this.meta = Object.assign({type: 'identifier', argument: false, bound: false}, meta || {});
		this.name = name;
		this.canonical = AST.tools.toCanonicalName(name);
	},

	Integer: function(num, meta) {
		this.meta = Object.assign({type: 'integer'}, meta || {});

		this.value = num;
	},

	Vector: function(vals, meta) {
		this.meta = Object.assign({type: 'vector', lvalue: false}, meta || {});

		this.values = vals;
	},

	Operator: function(op, lhs, rhs, meta) {
		this.meta = Object.assign({type: 'operator'}, meta || {});

		this.operator = op;
		this.lhs = lhs;
		this.rhs = rhs;
	},

	Comment: function (text, meta) {
		this.meta = Object.assign({type: 'comment'}, meta || {});

		this.text = text;
	},

};

AST.Block.prototype.getUnbound = function() {
	
};

// Transformation macros

AST.Program.prototype.applyTransformations = function(transformations) {
	return transformations.reduce((node, xfm) => node.transform(xfm), this);
};


// Transform funcs because ugh

AST.Program.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.statements = node.statements.map(st =>
			st.transform.apply(st, [transformFunc].concat(args)));
	}

	return node;
};

AST.Block.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.statements = node.statements.map(st =>
			st.transform.apply(st, [transformFunc].concat(args)));
	}

	return node;
};

AST.Loop.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		// TODO: Transform apply changes here!
		if (this.iterator !== null && this.start !== null && this.stop !== null) {
			node.iterator = node.iterator.transform.apply(
					node.iterator, [transformFunc].concat(args));
			node.start = node.start.transform.apply(
					node.start, [transformFunc].concat(args));
			node.stop = node.stop.transform.apply(
					node.stop, [transformFunc].concat(args));
		}
		node.statements = node.statements.map(st =>
			st.transform.apply(st, [transformFunc].concat(args)));
	}

	return node;
};

AST.Condition.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.predicate = node.predicate.transform.apply(
				node.predicate, [transformFunc].concat(args));
		node.statements = node.statements.map(st =>
			st.transform.apply(st, [transformFunc].concat(args)));
	}
	
	return node;
};

AST.Not.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.expression = node.expression.transform.apply(
				node.expression, [transformFunc].concat(args));
	}
	
	return node;
};

AST.LessThan.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.lhs = node.lhs.transform.apply(node.lhs, [transformFunc].concat(args));
		node.rhs = node.rhs.transform.apply(node.rhs, [transformFunc].concat(args));
	}

	return node;
};

AST.Equals.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.lhs = node.lhs.transform.apply(node.lhs, [transformFunc].concat(args));
		node.rhs = node.rhs.transform.apply(node.rhs, [transformFunc].concat(args));
	}

	return node;
};

AST.Command.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.name = node.name.transform.apply(node.name, [transformFunc].concat(args));
		node.args = node.args.map(arg =>
			arg.transform.apply(arg, [transformFunc].concat(args)));
		node.statements = node.statements.map(st =>
			st.transform.apply(st, [transformFunc].concat(args)));
	}

	return node;
};

AST.Number.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.name = node.name.transform.apply(node.name, [transformFunc].concat(args));
		node.args = node.args.map(arg =>
			arg.transform.apply(arg, [transformFunc].concat(args)));
		node.statements = node.statements.map(st =>
			st.transform.apply(st, [transformFunc].concat(args)));
	}

	return node;
};

AST.Statement.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.args = node.args.map(arg =>
				arg.transform.apply(arg, [transformFunc].concat(args)));
	}

	return node;
};

AST.Generator.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.args = node.args.map(arg =>
				arg.transform.apply(arg, [transformFunc].concat(args)));
	}

	return node;
};

AST.Identifier.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, __] = transformFunc.apply(null, [this].concat(args));
	return node;
};

AST.Integer.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, __] = transformFunc.apply(null, [this].concat(args));
	return node;
};

AST.Vector.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.values = node.values.map(val =>
				val.transform.apply(val, [transformFunc].concat(args)));
	}

	return node;
};

AST.Operator.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, descend] = transformFunc.apply(null, [this].concat(args));

	if (descend) {
		node.lhs = node.lhs.transform.apply(node.lhs, [transformFunc].concat(args));
		node.rhs = node.rhs.transform.apply(node.rhs, [transformFunc].concat(args));
	}

	return node;
};

AST.Comment.prototype.transform = function(transformFunc) {
	const args = Array.prototype.slice.call(arguments, 1);
	let [node, __] = transformFunc.apply(null, [this].concat(args));
	return node;
};



// Indentification functions. (Required for the "Beautify" feature).
function prefix(depth) {
	return '    '.repeat(depth);
}

AST.Program.prototype.indent = function(depth) {
	if (this.statements && this.statements.length > 0) {
		return this.statements.map(st => st.indent(0)).join('\n').replace(/^\n/, '');
	} else {
		return '';
	}
};

AST.Block.prototype.indent = function(depth) {
	const indent = prefix(depth);
	let comment = '';

	if (this.comment) {
		comment = '  ' + this.comment.indent(0);
	}

	if (this.statements && this.statements.length > 0) {
		return (indent + '{\n' +
			this.statements.map(st => st.indent(depth + 1)).join('\n').replace(/^\n/, '') + '\n' +
			indent + '}' + comment);
	} else {
		return (indent + '{\n' + indent + '}' + comment);
	}
};

AST.Statement.prototype.indent = function(depth) {
	let linespace = '';

	if (this.canonical in AST.controlFlow || this.preceding > 1) {
		linespace = '\n';
	}

	const indent = linespace + prefix(depth);
	let comment = '';

	if (this.comment) {
		comment = '  ' + this.comment.indent(0);
	}

	return (indent + this.canonical + ' ' + 
		this.args.map(a => a.indent()).join(' ') + comment);
};

AST.Comment.prototype.indent = function(depth) {
	const indent = (this.preceding && this.preceding > 1 ? '\n' : '') + prefix(depth);
	let text;

	if (this.text.indexOf(' ') !== 0) {
		text = ' ' + this.text;
	} else {
		text = this.text;
	}

	return indent + '//' + text;
};

// The following indentation functions are for constructs that must be entirely
// on one line (IS THIS ACTUALLY TRUE?)

AST.Integer.prototype.indent = function() {
	return this.value.toString();
};

AST.Identifier.prototype.indent = function() {
	return this.name;
};

AST.Generator.prototype.indent = function() {
	return '<' + this.canonical + ' ' + this.args.map(a => a.indent(0)).join(' ') + '>';
};

AST.Vector.prototype.indent = function () {
	return '[' + this.values.map(v => v.indent()).join(' ') + ']';
};

AST.Operator.prototype.indent = function() {
	let expressionString = (this.lhs.indent(0) + this.operator + this.rhs.indent(0));

	if (this.parenthesized) {
		return '(' + expressionString + ')';
	} else {
		return expressionString;
	}
};


// Stringification functions.

AST.Program.prototype.toString = function() {
	if (this.statements && this.statements.length > 0) {
		return this.statements.map(st => st.toString()).join('\n')
		//	.concat(this.defns.map(def => def.toString())).join('\n');
	} else {
		return '';
	}
};

AST.Block.prototype.toString = function() {
	if (this.statements && this.statements.length > 0) {
		var toString = window.AST.Program.prototype.toString;
		return '{\n\t' + toString.apply(this).replace(/\n/g, '\n\t') + '\n}';
	} else {
		return '{}';
	}
};

AST.Loop.prototype.toString = function() {
	if (this.iterator === null && this.start === null && this.stop === null) {
		return 'Loop [forever] {' + this.statements.map(s => s.toString()).join('\n') + '}';
	}

	return 'Loop [' + this.iterator + ' ' + this.start + ' ' + this.stop + '] {'
		+ this.statements.map(s => s.toString()).join('\n') + '}';
},

AST.Condition.prototype.toString = function() {
	return 'Condition [' + this.predicate + '] {' + this.statements.map(s => s.toString()).join('\n') + '}';
},

AST.Not.prototype.toString = function() {
	return '!' + this.expression;
},

AST.LessThan.prototype.toString = function() {
	return this.lhs + '<' + this.rhs;
},

AST.Equals.prototype.toString = function() {
	return this.lhs + '==' + this.rhs;
},

AST.Command.prototype.toString = function() {
	return 'Command [' + this.name.canonical + ' ' + this.args.join(' ') + '] {' 
		+ this.statements.map(s => s.toString()).join('\n') + '}';
};

AST.Number.prototype.toString = function() {
	return 'Number [' + this.name.canonical + ' ' + this.args.join(' ') + '] {' 
		+ this.statements.map(s => s.toString()).join('\n') + '}';
};

AST.Statement.prototype.toString = function() {
	return "Statement [" + this.canonical + " " + this.args.join(' ') + "]";
};

AST.Generator.prototype.toString = function() {
	return "<" + this.canonical + " " + this.args.join(' ') + ">";
};

AST.Identifier.prototype.toString = function() {
	return (this.meta.argument ? 'arg:' : 'lcl:') + this.name;
};

AST.Integer.prototype.toString = function() {
	return this.value.toString();
};

AST.Vector.prototype.toString = function() {
	return "[" + this.values.join(', ') + "]"
};

AST.Operator.prototype.toString = function() {
	return "(" + this.lhs + this.operator + this.rhs + ")"
};

AST.Comment.prototype.toString = function() {
	return "('" + this.text + "')";
};


// Canonicalizing Functions
// ------------------------

AST.Identifier.prototype.canonical = function() {
	return AST.tools.toCanonicalName(this.name);
};

// Functions to emit bytecode:

AST.Program.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	const range = n => Array(n).fill(0).map((x, y) => y);

	return [Op.STACK_ALLOC, this.meta.locals.length]
		.concat(this.statements.flatMap(s => s.emit()))
		.concat([
			Op.STACK_FREE, this.meta.locals.length,
			Op.HALT])
		.concat(this.definitions.flatMap(d => d.emit()))
		.concat(this.exports.flatMap(fn => {
			// We need to generate and append the pre-rolled assembly
			// code for Bresenham's line algorithm
			return [Op.LABEL, fn.name]
				// We just set argument indexes because the assemble function
				// needs *something* to latch onto
				.concat(range(fn.length).reverse().flatMap(a => [Op.SET_ARGUMENT, a]))
				.concat([
					Op.INVOKE, fn.length, fn.name,
					Op.RETURN
				]);
		}))
		.concat(emitBuiltins());

};

AST.Block.prototype.emit = function() {
	return this.statements.flatMap((s) => s.emit());
};

AST.Loop.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	const _body = AST.tools.gensym();

	// Special case for infinite loops!
	if (this.iterator === null && this.start === null && this.stop === null) {
		return [Op.LOCATION_PUSH, start, end, Op.LABEL, _body]
			.concat(this.statements.flatMap(s => s.emit()))
			.concat(this.meta.inner ? [Op.REDRAW] : [])
			.concat(Op.JUMP, _body, Op.LOCATION_POP);
	}

	const isArgument = this.meta.argument === true;
	const store_iterator = isArgument ? Op.SET_ARGUMENT : Op.SET_LOCAL;
	const load_iterator = isArgument ? Op.GET_ARGUMENT : Op.GET_LOCAL;

	const _increment = AST.tools.gensym();
	const _break = AST.tools.gensym();

	return [Op.LOCATION_PUSH, start, end].concat(this.stop.emit()).concat([
		Op.DUPLICATE,
	]).concat(this.start.emit()).concat([
		Op.DUPLICATE,
		store_iterator, this.iterator.canonical,
		Op.SUBTRACT,
		Op.DUPLICATE,
		Op.LABEL, _body,
	]).concat(this.statements.flatMap(s => s.emit())).concat([
		Op.JUMP_IF_ZERO, _break,
		Op.JUMP_IF_NONNEGATIVE, _increment,

		Op.DUPLICATE,
		load_iterator, this.iterator.canonical,
		Op.CONSTANT, 1,
		Op.SUBTRACT,
		Op.DUPLICATE,
		store_iterator, this.iterator.canonical,
		Op.SUBTRACT,
		Op.DUPLICATE,
	]).concat(this.meta.inner ? [Op.REDRAW] : []).concat([
		Op.JUMP, _body,

		Op.LABEL, _increment,
		Op.DUPLICATE,
		load_iterator, this.iterator.canonical,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.DUPLICATE,
		store_iterator, this.iterator.canonical,
		Op.SUBTRACT,
		Op.DUPLICATE,
	]).concat(this.meta.inner ? [Op.REDRAW] : []).concat([
		Op.JUMP, _body,

		Op.LABEL, _break,
		Op.POP,
		Op.POP,
		Op.LOCATION_POP
	]);
}

AST.Condition.prototype.emit = function() {
	// Emit bytecode for conditionals. Commands that are compiled to
	// conditionals are `same?`, `notsame?`, `smaller?`, and `notsmaller?`.
	// The conditionals are transformed into predicates using the
	// `Not`, `LessThan`, and `Equals` nodes.
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	const endlabel = AST.tools.gensym();

	if (this.predicate.meta.type === 'not') {
		const bodylabel = AST.tools.gensym();

		return [Op.LOCATION_PUSH, start, end]
			.concat(this.predicate.emit())
			.concat([
				bodylabel,
				Op.JUMP, endlabel,
				Op.LABEL, bodylabel])
			.concat(this.statements.flatMap(s => s.emit()))
			.concat([Op.LABEL, endlabel, Op.LOCATION_POP]);
	} else {
		return [Op.LOCATION_PUSH, start, end]
			.concat(this.predicate.emit())
			.concat([endlabel])
			.concat(this.statements.flatMap(s => s.emit()))
			.concat([Op.LABEL, endlabel, Op.LOCATION_POP]);
	}
};

AST.Not.prototype.emit = function() {
	return this.expression.emit();
};

AST.LessThan.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return this.lhs.emit()
		.concat(this.rhs.emit()).concat([
			Op.SUBTRACT,
			Op.JUMP_IF_NONNEGATIVE,
		]);
};

AST.Equals.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return this.lhs.emit()
		.concat(this.rhs.emit()).concat([
			Op.SUBTRACT,
			Op.JUMP_IF_NONZERO,
		]);
};

AST.Command.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return ([
		Op.LOCATION_PUSH, start, end,
		Op.LABEL, this.name.canonical,
		Op.STACK_ALLOC, this.meta.locals.length + this.meta.unbound.length])
	.concat(this.args.flatMap(a => [Op.ARGUMENT, a.canonical]))
	.concat(this.args.slice(0).reverse().flatMap(a => [Op.SET_ARGUMENT, a.canonical]))
	.concat(this.meta.unbound.slice(0).reverse().flatMap(a => [Op.SET_LOCAL, a]))
	.concat(this.statements.flatMap(s => s.emit()))
	.concat([Op.CONSTANT, 0])
	.concat(this.meta.unbound.slice(0).reverse().flatMap(a => [Op.GET_LOCAL, a]))
	.concat([
		Op.STACK_FREE, this.meta.locals.length + this.meta.unbound.length,
		Op.RETURN])
	.concat(this.definitions.flatMap(d => d.emit())).concat([
		Op.LOCATION_POP
	]);
};

AST.Number.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return ([
		Op.LOCATION_PUSH, start, end,
		Op.LABEL, this.name.canonical,
		Op.STACK_ALLOC, this.meta.locals.length + this.meta.unbound.length])
	.concat(this.args.flatMap(a => [Op.ARGUMENT, a.canonical]))
	.concat(this.args.slice(0).reverse().flatMap(a => [Op.SET_ARGUMENT, a.canonical]))
	.concat(this.meta.unbound.slice(0).reverse().flatMap(a => [Op.SET_LOCAL, a]))
	.concat(this.statements.flatMap(s => s.emit()))
	.concat(this.meta.unbound.flatMap(a => [Op.GET_LOCAL, a]))
	.concat([
		Op.STACK_FREE, this.meta.locals.length + this.meta.unbound.length,
		Op.RETURN])
	.concat(this.definitions.flatMap(d => d.emit())).concat([Op.LOCATION_POP]);
};

AST.Statement.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	switch (this.canonical) {
		case 'Paper': {
			if (this.args.length === 1) {
				return ([
					Op.LOCATION_PUSH, start, end, 
					Op.REDRAW, Op.CONSTANT, 255
				]).concat(this.args[0].emit()).concat([
					Op.CONSTANT, 0,
					Op.CONSTANT, 100,
					Op.CLAMP,
					Op.CONSTANT, 255,
					Op.MULTIPLY,
					Op.CONSTANT, 100,
					Op.DIVIDE,
					Op.SUBTRACT,
					Op.PACK_GRAY,
					Op.FILL_CANVAS,
					Op.LOCATION_POP
				]);
			} else {
				return ([
					Op.LOCATION_PUSH, start, end, Op.REDRAW
				]).concat(this.args.flatMap(x => {
					return x.emit().concat([
						Op.CONSTANT, 0,
						Op.CONSTANT, 100,
						Op.CLAMP,
						Op.CONSTANT, 255,
						Op.MULTIPLY,
						Op.CONSTANT, 100,
						Op.DIVIDE
					]);
				})).concat([
					Op.PACK_RGB,
					Op.FILL_CANVAS,
					Op.LOCATION_POP
				]);
			}
		}
		case 'Pen': {
			if (this.args.length === 1) {
				let rvalue = this.args[0].emit();

				return ([
					Op.LOCATION_PUSH, start, end, 
					Op.CONSTANT, 255
				]).concat(rvalue).concat([
					Op.CONSTANT, 0,
					Op.CONSTANT, 100,
					Op.CLAMP,
					Op.CONSTANT, 255,
					Op.MULTIPLY,
					Op.CONSTANT, 100,
					Op.DIVIDE,
					Op.SUBTRACT,
					Op.PACK_GRAY,
					Op.SET_PEN_COLOR,
					Op.LOCATION_POP
				]);
			} else {
				return ([
					Op.LOCATION_PUSH, start, end
				]).concat(this.args.map(x => {
					return x.emit().concat([
						Op.CONSTANT, 0,
						Op.CONSTANT, 100,
						Op.CLAMP,
						Op.CONSTANT, 255,
						Op.MULTIPLY,
						Op.CONSTANT, 100,
						Op.DIVIDE
					])
				})).concat([
					Op.PACK_RGB,
					Op.SET_PEN_COLOR,
					Op.LOCATION_POP
				]);
			}
		}
		case 'Set': {
			if (this.args[0].meta.type === 'vector') {
				// we're setting a pixel. We don't want to change the pen color
				let lvalue = this.args[0].emit();
				let rvalue = this.args[1].emit();

				if (this.args[1].meta.type === 'vector') {
					return ([
						Op.LOCATION_PUSH, start, end
					]).concat(lvalue).concat(rvalue).concat([
						Op.PACK_GRAY,
						Op.WRITE_PIXEL,
						Op.LOCATION_POP
					]);
				} else {
					return ([
						Op.LOCATION_PUSH, start, end
					]).concat(lvalue).concat([
						Op.CONSTANT, 255
					]).concat(rvalue).concat([
						Op.CONSTANT, 0,
						Op.CONSTANT, 100,
						Op.CLAMP,
						Op.CONSTANT, 255,
						Op.MULTIPLY,
						Op.CONSTANT, 100,
						Op.DIVIDE,
						Op.SUBTRACT,
						Op.PACK_GRAY,
						Op.WRITE_PIXEL,
						Op.LOCATION_POP
					]);
				}
			} else if (this.args[0].meta.type === 'connector') {
				// The statement is in the form Set <Array 0> 100
				const gen = this.args[0];
				return ([Op.LOCATION_PUSH, start, end])
					.concat(gen.args.flatMap(a => a.emit()))
					.concat(this.args[1].emit())
					.concat([
						Op.STACK_ALLOC, gen.args.length + 1,
						Op.CALL, gen.canonical + '_set',
						Op.STACK_FREE, gen.args.length + 1,
						Op.POP,
						Op.LOCATION_POP
					]);
			} else {
				let rvalue = this.args[1].emit();

				if (this.args[0].meta.argument === true) {
					return ([Op.LOCATION_PUSH, start, end])
						.concat(rvalue)
						.concat([
							Op.SET_ARGUMENT, this.args[0].canonical,
							Op.LOCATION_POP
						]);
				} else {
					return ([Op.LOCATION_PUSH, start, end])
						.concat(rvalue)
						.concat([
							Op.SET_LOCAL, this.args[0].canonical,
							Op.LOCATION_POP
						]);
				}
			}
		}
		case 'Line': {
			return ([Op.LOCATION_PUSH, start, end])
				.concat(this.args.flatMap(a => a.emit()))
				.concat([
					Op.STACK_ALLOC, 4,
					Op.CALL, 'line',
					Op.STACK_FREE, 4,
					Op.POP,
					Op.LOCATION_POP
				]);
		}
		case 'Value': {
			// TODO: This is essentially a return statement but it kind of
			// has to go at the end of the function definition.
			return ([Op.LOCATION_PUSH, start, end])
				.concat(this.args[0].emit())
				.concat([Op.LOCATION_POP]);
			/*
			.concat([
				Op.STACK_FREE, 0,
				Op.RETURN
			]);*/
		}
		case 'Pause': {
			return [Op.LOCATION_PUSH, start, end]
				.concat(this.args[0].emit())
				.concat(Op.PAUSE, Op.LOCATION_POP);
		}
		case 'Refresh': {
			return [Op.LOCATION_PUSH, start, end, Op.REDRAW, Op.LOCATION_POP];
		}
		default: {
			// At this point all we're left with are function calls I guess
			return [Op.LOCATION_PUSH, start, end]
				.concat(this.meta.unbound.flatMap(id => [Op.GET_LOCAL, id]))
				.concat(this.args.flatMap(a => a.emit()))
				.concat([
					Op.STACK_ALLOC, this.args.length,
					Op.CALL, this.canonical,
					Op.STACK_FREE, this.args.length,
					Op.POP
				])
				.concat(this.meta.unbound.slice(0).reverse().flatMap(id => [Op.SET_LOCAL, id]))
				.concat([Op.LOCATION_POP]);
		}
	}
};

AST.Generator.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return [Op.LOCATION_PUSH, start, end]
		.concat(this.meta.unbound.flatMap(id => [Op.GET_LOCAL, id]))
		.concat(this.args.flatMap(a => a.emit()))
		.concat([
			Op.STACK_ALLOC, this.args.length,
			Op.CALL, this.canonical,
			Op.STACK_FREE, this.args.length
		])
		.concat(this.meta.unbound.slice(0).reverse().flatMap(id => [Op.SET_LOCAL, id]))
		.concat([Op.LOCATION_POP]);
};

AST.Identifier.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	if (this.meta.argument === true) {
		return [Op.LOCATION_PUSH, start, end, Op.GET_ARGUMENT, this.canonical, Op.LOCATION_POP];
	} else {
		return [Op.LOCATION_PUSH, start, end, Op.GET_LOCAL, this.canonical, Op.LOCATION_POP];
	}
};

AST.Integer.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return [Op.LOCATION_PUSH, start, end, Op.CONSTANT, this.value, Op.LOCATION_POP];
};

AST.Vector.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return ([
		Op.LOCATION_PUSH, start, end
	]).concat(this.meta.lvalue ? [] : [Op.CONSTANT, 100])
		.concat(this.values.flatMap((x) => x.emit()))
		.concat(this.meta.lvalue ? [] : [
			Op.READ_PIXEL, 
			Op.UNPACK_GRAY,
			Op.CONSTANT, 100,
			Op.MULTIPLY,
			Op.CONSTANT, 255,
			Op.DIVIDE,
			Op.SUBTRACT,
			Op.LOCATION_POP
		]);
};

AST.Operator.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	const opcodes = {
		'+': Op.ADD,
		'-': Op.SUBTRACT,
		'*': Op.MULTIPLY,
		'/': Op.DIVIDE,
		'%': Op.REMAINDER,
	};
	
	return ([Op.LOCATION_PUSH, start, end]).concat(this.lhs.emit())
		.concat(this.rhs.emit())
		.concat(opcodes[this.operator], Op.LOCATION_POP);
};

AST.Comment.prototype.emit = function() { return []; }

export default AST;

