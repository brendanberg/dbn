import * as Op from './opcodes';
import assemble from './assemble';

let currentSymbol = 0;

const AST = {

	tools: {
		toCanonicalName: function(name) {
			return name.toLowerCase();
		},
		gensym: function() {
			return '$' + (currentSymbol++).toString(36).toUpperCase();
		}
	},

	reservedWords: [
		'load',
		'paper',
		'pen',
		'line',
		'set',
		'value',
		'repeat',
		'forever',
		'same?',
		'notsame?',
		'smaller?',
		'notsmaller?',
		'command',
		'number'
	],

	controlFlow: {
		'repeat': function(stmnt, body) {
			var name = stmnt.args[0],
				start = stmnt.args[1],
				stop = stmnt.args[2];

			if (!name) {
				throw {
					message: '"repeat" expects a variable name as the first parameter',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (!(start && stop)) {
				throw {
					message: '"repeat" requires both start and end values',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (name.meta.type !== 'identifier') {
				throw {
					message: '"repeat" expects a variable name as the first parameter',
					start: name.meta.start,
					end: name.meta.end
				};
			} else  if (stmnt.args.length > 3) {
				throw {
					message: '"repeat" expects only three parameters',
					start: stmnt.args[3].meta.start,
					end: stmnt.args[stmnt.args.length - 1].meta.end
				};
			}

			return new AST.Loop(name, start, stop, body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'forever': function(forever, body) {
			if (forever.args.length) {
				throw {
					message: '"forever" must be followed by a new line',
					start: forever.meta.start,
					end: forever.meta.end
				};
			}

			return new AST.Loop(null, null, null, body.statements, {
				start: forever.meta.start,
				end: body.meta.end
			});
		},
		'same?': function(stmnt, body) {
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
		'notsame?': function(stmnt, body) {
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
		'smaller?': function(stmnt, body) {
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
		'notsmaller?': function(stmnt, body) {
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
		'command': function(stmnt, body) {
			if (stmnt.args.length < 1) {
				throw {
					message: '"command" requires a name as the first parameter',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (stmnt.args[0].meta.type !== 'identifier') {
				throw {
					message: '"command" requires a name as the first parameter',
					start: stmnt.args[0].meta.start,
					end: stmnt.args[0].meta.end
				};
			} else if (stmnt.args.slice(1).filter(x => x.meta.type !== 'identifier').length) {
				throw {
					message: 'additional parameters to "command" must be variable names',
					start: stmnt.args[1].meta.start,
					end: stmnt.args[stmnt.args.length - 1].meta.end
				}
			}

			return new AST.Command(stmnt.args[0], stmnt.args.slice(1), body.statements, {
				start: stmnt.meta.start,
				end: body.meta.end
			});
		},
		'number': function(stmnt, body) {
			// TODO: Disallow side effects.
			if (stmnt.args.length < 1) {
				throw {
					message: '"number" requires a name as the first parameter',
					start: stmnt.meta.start,
					end: stmnt.meta.end
				};
			} else if (stmnt.args[0].meta.type !== 'identifier') {
				throw {
					message: '"number" requires a name as the first parameter',
					start: stmnt.args[0].meta.start,
					end: stmnt.args[0].meta.end
				};
			} else if (stmnt.args.slice(1).filter(x => x.meta.type !== 'identifier').length) {
				throw {
					message: 'additional parameters to "number" must be variable names',
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
		'mouse': [1],
		'key': [1],
		'time': [1],
		'net': [1],
		'array': [1],
		'abs': [1]
	},
	
	commands: {
		'paper': [1, 3],
		'pen': [1, 3],
		'set': [2],
		'line': [4],
		'field': [5]
	},

	Program: function (statements, meta) {
		this.meta = Object.assign({
				type: 'program',
				locals: [],
				// IMPORTANT! There shouldn't actually be unbound or args on
				// a program. These properties are here so transforms don't fail
				unbound: [],
			}, meta || {});

		//this.locals = [];
		//this.defns = [];
		//this.outerDefns = [];
		this.args = [];
		this.statements = statements;
		this.definitions = [];
		this.exports = [];
	},

	Block: function(statements, meta) {
		this.meta = Object.assign({type: 'block'}, meta || {});

		//this.locals = [];
		//this.defns = [];
		this.outerDefns = [];
		this.statements = statements;
	},

	Loop: function(name, start, stop, statements, meta) {
		// TODO: Ensure start and stop are scalar value types.
		this.meta = Object.assign({type: 'loop', inner: true}, meta || {});
		//this.locals = [];
		this.iterator = name;
		this.start = start;
		this.stop = stop;
		this.statements = statements;
	},

	Condition: function(predicate, statements, meta) {
		this.meta = Object.assign({type: 'condition'}, meta || {});
		this.predicate = predicate;
		//this.locals = [];
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
		//this.locals = [];
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
		//this.locals = [];
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
	},

	Generator: function (name, args, meta) {
		this.meta = Object.assign({type: 'connector'}, meta || {});

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
		this.meta = Object.assign({type: 'vector'}, meta || {});

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
	return this.name.toLowerCase();
};

// Functions to emit bytecode:

AST.Program.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	const range = n => Array(n).fill(0).map((x, y) => y);

	let program = [Op.STACK_ALLOC, this.meta.locals.length]
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
		}));

	const _abs_a = AST.tools.gensym();

	const _line_a = AST.tools.gensym();
	const _line_b = AST.tools.gensym();
	const _line_c = AST.tools.gensym();
	const _line_d = AST.tools.gensym();
	const _line_e = AST.tools.gensym();
	const _line_f = AST.tools.gensym();
	
	const _plotlow = AST.tools.gensym();
	const _plotlow_a = AST.tools.gensym();
	const _plotlow_b = AST.tools.gensym();
	const _plotlow_c = AST.tools.gensym();
	const _plotlow_d = AST.tools.gensym();
	const _plotlow_e = AST.tools.gensym();
	const _plotlow_f = AST.tools.gensym();
	
	const _plothigh = AST.tools.gensym();
	const _plothigh_a = AST.tools.gensym();
	const _plothigh_b = AST.tools.gensym();
	const _plothigh_c = AST.tools.gensym();
	const _plothigh_d = AST.tools.gensym();
	const _plothigh_e = AST.tools.gensym();
	const _plothigh_f = AST.tools.gensym();

	const _field_a = AST.tools.gensym();
	const _field_b = AST.tools.gensym();
	const _field_c = AST.tools.gensym();
	const _field_d = AST.tools.gensym();
	const _field_e = AST.tools.gensym();
	const _field_f = AST.tools.gensym();

	return program.concat([
		Op.LOCATION, 0, 0,
		Op.LABEL, 'abs',
		Op.STACK_ALLOC, 0,
		Op.DUPLICATE,
		Op.JUMP_IF_NEGATIVE, _abs_a,
		Op.STACK_FREE, 0,
		Op.RETURN,
		Op.LABEL, _abs_a,
		Op.NEGATE,
		Op.STACK_FREE, 0,
		Op.RETURN,
	//	-------------------------------
		Op.LABEL, 'field',
		Op.STACK_ALLOC, 2,
		Op.SET_ARGUMENT, 4,
		Op.SET_ARGUMENT, 3,
		Op.SET_ARGUMENT, 2,
		Op.SET_ARGUMENT, 1,
		Op.SET_ARGUMENT, 0,
		Op.CONSTANT, 255,
		Op.GET_ARGUMENT, 4,
		Op.DUPLICATE,
		Op.JUMP_IF_NEGATIVE, _field_a,
		Op.DUPLICATE,
		Op.CONSTANT, 100,
		Op.SUBTRACT,
		Op.JUMP_IF_NONNEGATIVE, _field_b,
		Op.JUMP, _field_c,
		Op.LABEL, _field_a,
		Op.POP,
		Op.CONSTANT, 0,
		Op.JUMP, _field_c,
		Op.LABEL, _field_b,
		Op.POP,
		Op.CONSTANT, 100,
		Op.LABEL, _field_c,
		Op.CONSTANT, 255,
		Op.MULTIPLY,
		Op.CONSTANT, 100,
		Op.DIVIDE,
		Op.SUBTRACT,
		Op.PACK_GRAY,
		Op.SET_PEN_COLOR,
		Op.GET_ARGUMENT, 0,
		Op.DUPLICATE,
		Op.SET_LOCAL, 0,
		Op.GET_ARGUMENT, 2,
		Op.DUPLICATE,
		Op.SET_LOCAL, 1,
		Op.SUBTRACT,
		Op.LABEL, _field_d,
		Op.GET_LOCAL, 0,
		Op.GET_ARGUMENT, 1,
		Op.GET_LOCAL, 0,
		Op.GET_ARGUMENT, 3,
		Op.STACK_ALLOC, 4,
		Op.CALL, 'line',
		Op.STACK_FREE, 4,
		Op.POP,
		Op.DUPLICATE,
		Op.JUMP_IF_NEGATIVE, _field_e,
		Op.GET_LOCAL, 1,
		Op.GET_LOCAL, 0,
		Op.DUPLICATE,
		Op.CONSTANT, 1,
		Op.SUBTRACT,
		Op.SET_LOCAL, 0,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT,
		Op.JUMP, _field_f,
		Op.LABEL, _field_e,
		Op.GET_LOCAL, 0,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.DUPLICATE,
		Op.SET_LOCAL, 0,
		Op.GET_LOCAL, 1,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT,
		Op.LABEL, _field_f,
		Op.JUMP_IF_NEGATIVE, _field_d,
		Op.POP,
		Op.STACK_FREE, 2,
		Op.CONSTANT, 0,
		Op.RETURN,
	//	-------------------------------
		Op.LABEL, 'line',
		Op.STACK_ALLOC, 2,
		Op.ARGUMENT, 'x0',
		Op.ARGUMENT, 'y0',
		Op.ARGUMENT, 'x1',
		Op.ARGUMENT, 'y1',
		Op.SET_ARGUMENT, 'y1', // 3
		Op.SET_ARGUMENT, 'x1', // 2
		Op.SET_ARGUMENT, 'y0', // 1
		Op.SET_ARGUMENT, 'x0', // 0

		Op.GET_ARGUMENT, 'y1',
		Op.GET_ARGUMENT, 'y0',
		Op.SUBTRACT,
		Op.CALL, 'abs',
		Op.SET_LOCAL, 'magY', // 0
		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'x0',
		Op.SUBTRACT,
		Op.CALL, 'abs',
		Op.SET_LOCAL, 'magX', // 1

		Op.GET_LOCAL, 'magX',
		Op.GET_LOCAL, 'magY',
		Op.SUBTRACT,
		Op.JUMP_IF_NEGATIVE, _line_a,

		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'x0',
		Op.SUBTRACT,
		Op.JUMP_IF_NEGATIVE, _line_b,
		Op.GET_ARGUMENT, 'x0',
		Op.GET_ARGUMENT, 'y0',
		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'y1',
		Op.JUMP, _line_c,
		Op.LABEL, _line_b,
		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'y1',
		Op.GET_ARGUMENT, 'x0',
		Op.GET_ARGUMENT, 'y0',
		Op.LABEL, _line_c,
		Op.STACK_ALLOC, 4,
		Op.CALL, _plotlow,
		Op.STACK_FREE, 4,
		Op.POP,
		Op.JUMP, _line_f,

		Op.LABEL, _line_a,
		Op.GET_ARGUMENT, 'y1',
		Op.GET_ARGUMENT, 'y0',
		Op.SUBTRACT,
		Op.JUMP_IF_NEGATIVE, _line_d,
		Op.GET_ARGUMENT, 'x0',
		Op.GET_ARGUMENT, 'y0',
		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'y1',
		Op.JUMP, _line_e,
		Op.LABEL, _line_d,
		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'y1',
		Op.GET_ARGUMENT, 'x0',
		Op.GET_ARGUMENT, 'y0',
		Op.LABEL, _line_e,
		Op.STACK_ALLOC, 4,
		Op.CALL, _plothigh,
		Op.STACK_FREE, 4,
		Op.POP,

		Op.LABEL, _line_f,
		Op.STACK_FREE, 2,
		Op.CONSTANT, 0,
		Op.RETURN,
	//	-------------------------------
		Op.LABEL, _plotlow,
		Op.STACK_ALLOC, 7,
		Op.ARGUMENT, 'x0',
		Op.ARGUMENT, 'y0',
		Op.ARGUMENT, 'x1',
		Op.ARGUMENT, 'y1',
		Op.SET_ARGUMENT, 'y1',
		Op.SET_ARGUMENT, 'x1',
		Op.SET_ARGUMENT, 'y0',
		Op.SET_ARGUMENT, 'x0',
		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'x0',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'dx',
		Op.GET_ARGUMENT, 'y1',
		Op.GET_ARGUMENT, 'y0',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'dy',
		Op.CONSTANT, 1,
		Op.SET_LOCAL, 'yi',
		Op.GET_LOCAL, 'dy',
		Op.CONSTANT, 0,
		Op.SUBTRACT,
		Op.JUMP_IF_NONNEGATIVE, _plotlow_a,
		Op.CONSTANT, -1,
		Op.SET_LOCAL, 'yi',
		Op.CONSTANT, 0,
		Op.GET_LOCAL, 'dy',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'dy',
		Op.LABEL, _plotlow_a,
		Op.CONSTANT, 2,
		Op.GET_LOCAL, 'dy',
		Op.MULTIPLY,
		Op.GET_LOCAL, 'dx',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'd',
		Op.GET_ARGUMENT, 'y0',
		Op.SET_LOCAL, 'y',
		Op.GET_ARGUMENT, 'x0',
		Op.DUPLICATE,
		Op.SET_LOCAL, 'x',
		Op.GET_ARGUMENT, 'x1',
		Op.DUPLICATE,
		Op.SET_LOCAL, _plotlow_f,
		Op.SUBTRACT,
		Op.LABEL, _plotlow_b,
		Op.GET_LOCAL, 'x',
		Op.GET_LOCAL, 'y',
		Op.FILL_PIXEL,
		Op.CONSTANT, 0,
		Op.GET_LOCAL, 'd',
		Op.SUBTRACT,
		Op.JUMP_IF_NONNEGATIVE, _plotlow_c,
		Op.GET_LOCAL, 'y',
		Op.GET_LOCAL, 'yi',
		Op.ADD,
		Op.SET_LOCAL, 'y',
		Op.GET_LOCAL, 'd',
		Op.CONSTANT, 2,
		Op.GET_LOCAL, 'dx',
		Op.MULTIPLY,
		Op.SUBTRACT,
		Op.SET_LOCAL, 'd',
		Op.LABEL, _plotlow_c,
		Op.GET_LOCAL, 'd',
		Op.CONSTANT, 2,
		Op.GET_LOCAL, 'dy',
		Op.MULTIPLY,
		Op.ADD,
		Op.SET_LOCAL, 'd',
		Op.DUPLICATE,
		Op.JUMP_IF_NEGATIVE, _plotlow_d,
		Op.GET_LOCAL, _plotlow_f,
		Op.GET_LOCAL, 'x',
		Op.DUPLICATE,
		Op.CONSTANT, 1,
		Op.SUBTRACT,
		Op.SET_LOCAL, 'x',
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT,
		Op.JUMP, _plotlow_e,
		Op.LABEL, _plotlow_d,
		Op.GET_LOCAL, 'x',
		Op.CONSTANT, 1,
		Op.ADD,
		Op.DUPLICATE,
		Op.SET_LOCAL, 'x',
		Op.GET_LOCAL, _plotlow_f,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT,
		Op.LABEL, _plotlow_e,
		Op.JUMP_IF_NEGATIVE, _plotlow_b,
		Op.POP,
		Op.STACK_FREE, 7,
		Op.CONSTANT, 0,
		Op.RETURN,
	//	-------------------------------
		Op.LABEL, _plothigh,
		Op.STACK_ALLOC, 7,
		Op.ARGUMENT, 'x0',
		Op.ARGUMENT, 'y0',
		Op.ARGUMENT, 'x1',
		Op.ARGUMENT, 'y1',
		Op.SET_ARGUMENT, 'y1',
		Op.SET_ARGUMENT, 'x1',
		Op.SET_ARGUMENT, 'y0',
		Op.SET_ARGUMENT, 'x0',
		Op.GET_ARGUMENT, 'x1',
		Op.GET_ARGUMENT, 'x0',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'dx',
		Op.GET_ARGUMENT, 'y1',
		Op.GET_ARGUMENT, 'y0',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'dy',
		Op.CONSTANT, 1,
		Op.SET_LOCAL, 'xi',
		Op.GET_LOCAL, 'dx',
		Op.CONSTANT, 0,
		Op.SUBTRACT,
		Op.JUMP_IF_NONNEGATIVE, _plothigh_a,
		Op.CONSTANT, -1,
		Op.SET_LOCAL, 'xi',
		Op.CONSTANT, 0,
		Op.GET_LOCAL, 'dx',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'dx',
		Op.LABEL, _plothigh_a,
		Op.CONSTANT, 2,
		Op.GET_LOCAL, 'dx',
		Op.MULTIPLY,
		Op.GET_LOCAL, 'dy',
		Op.SUBTRACT,
		Op.SET_LOCAL, 'd',
		Op.GET_ARGUMENT, 'x0',
		Op.SET_LOCAL, 'x',
		Op.GET_ARGUMENT, 'y0',
		Op.DUPLICATE,
		Op.SET_LOCAL, 'y',
		Op.GET_ARGUMENT, 'y1',
		Op.DUPLICATE,
		Op.SET_LOCAL, _plothigh_f,
		Op.SUBTRACT,
		Op.LABEL, _plothigh_b,
		Op.GET_LOCAL, 'x',
		Op.GET_LOCAL, 'y',
		Op.FILL_PIXEL,
		Op.CONSTANT, 0,
		Op.GET_LOCAL, 'd',
		Op.SUBTRACT,
		Op.JUMP_IF_NONNEGATIVE, _plothigh_c,
		Op.GET_LOCAL, 'x',
		Op.GET_LOCAL, 'xi',
		Op.ADD,
		Op.SET_LOCAL, 'x',
		Op.GET_LOCAL, 'd',
		Op.CONSTANT, 2,
		Op.GET_LOCAL, 'dy',
		Op.MULTIPLY,
		Op.SUBTRACT,
		Op.SET_LOCAL, 'd',
		Op.LABEL, _plothigh_c,
		Op.GET_LOCAL, 'd',
		Op.CONSTANT, 2,
		Op.GET_LOCAL, 'dx',
		Op.MULTIPLY,
		Op.ADD,
		Op.SET_LOCAL, 'd',
		Op.DUPLICATE,
		Op.JUMP_IF_NEGATIVE, _plothigh_d,
		Op.GET_LOCAL, _plothigh_f,
		Op.GET_LOCAL, 'y',
		Op.DUPLICATE,
		Op.CONSTANT, 1,
		Op.SUBTRACT,
		Op.SET_LOCAL, 'y',
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT,
		Op.JUMP, _plothigh_e,
		Op.LABEL, _plothigh_d,
		Op.GET_LOCAL, 'y',
		Op.CONSTANT, 1,
		Op.ADD,
		Op.DUPLICATE,
		Op.SET_LOCAL, 'y',
		Op.GET_LOCAL, _plothigh_f,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT,
		Op.LABEL, _plothigh_e,
		Op.JUMP_IF_NEGATIVE, _plothigh_b,
		Op.POP,
		Op.STACK_FREE, 7,
		Op.CONSTANT, 0,
		Op.RETURN
	]);
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
		let assem = [Op.LABEL, _body].concat(this.statements.flatMap(s => s.emit()))
			.concat([Op.LOCATION, start, end]);;
		
		if (this.meta.inner) { assem.push(Op.REDRAW); }
		
		return assem.concat([
			Op.JUMP, _body
		]);
	}

	const _loop = AST.tools.gensym();
	const _endval = AST.tools.gensym();
	const _increment = AST.tools.gensym();

	let assem = this.start.emit().concat([
		Op.LOCATION, start, end,
		Op.DUPLICATE,
		Op.SET_LOCAL, this.iterator.canonical
	]).concat(this.stop.emit()).concat([
		Op.LOCATION, start, end,
		Op.DUPLICATE,
		Op.SET_LOCAL, _endval,
		Op.SUBTRACT,
		Op.LABEL, _body,
	]).concat(this.statements.flatMap(s => s.emit())).concat([
		Op.LOCATION, start, end,
		Op.DUPLICATE,
		Op.JUMP_IF_NEGATIVE, _increment, // Jump if start <= end

		Op.GET_LOCAL, _endval,
		Op.GET_LOCAL, this.iterator.canonical,
		Op.DUPLICATE,
		Op.CONSTANT, 1,
		Op.SUBTRACT,
		Op.SET_LOCAL, this.iterator.canonical,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT,
		Op.JUMP, _loop,

		Op.LABEL, _increment,
		Op.GET_LOCAL, this.iterator.canonical,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.DUPLICATE,
		Op.SET_LOCAL, this.iterator.canonical,
		Op.GET_LOCAL, _endval,
		Op.CONSTANT, 1,
		Op.ADD,
		Op.SUBTRACT
	]);

	if (this.meta.inner) { assem.push(Op.REDRAW); }

	return assem.concat([
		Op.LABEL, _loop,
		Op.JUMP_IF_NEGATIVE, _body,
		Op.POP
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

		let foo = [Op.LOCATION, start, end]
			.concat(this.predicate.emit())
			.concat([
				bodylabel,
				Op.JUMP, endlabel,
				Op.LABEL, bodylabel])
			.concat(this.statements.flatMap(s => s.emit()))
			.concat([Op.LABEL, endlabel]);

		console.log(foo);
		return foo
	} else {
		let foo = this.predicate.emit().concat([
			endlabel
		]).concat(this.statements.flatMap(s => s.emit())).concat([
			Op.LABEL, endlabel
		]);

		console.log(foo);
		return foo
	}
};

AST.Not.prototype.emit = function() {
	return this.expression.emit();
};

AST.LessThan.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return this.lhs.emit().concat(this.rhs.emit()).concat([
		Op.LOCATION, start, end,
		Op.SUBTRACT,
		Op.JUMP_IF_NONNEGATIVE
	]);
};

AST.Equals.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return this.lhs.emit().concat(this.rhs.emit()).concat([
		Op.LOCATION, start, end,
		Op.SUBTRACT,
		Op.JUMP_IF_NONZERO
	]);
};

AST.Command.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return ([
		Op.LOCATION, start, end,
		Op.LABEL, this.name.canonical,
		Op.STACK_ALLOC, this.meta.locals.length])
	.concat(this.args.flatMap(a => [Op.ARGUMENT, a.canonical]))
	.concat(this.meta.unbound.flatMap(a => [Op.ARGUMENT, a]))
	.concat(this.args.slice(0).reverse().flatMap(a => [Op.SET_ARGUMENT, a.canonical]))
	.concat(this.statements.flatMap(s => s.emit()))
	.concat([
		Op.LOCATION, start, end,
		Op.STACK_FREE, this.meta.locals.length,
		Op.CONSTANT, 0,
		Op.RETURN])
	.concat(this.definitions.flatMap(d => d.emit()));
};

AST.Number.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	const args = this.args.flatMap(a => [Op.ARGUMENT, a.canonical])
		.concat(this.args.slice(0).reverse()
			.flatMap(a => [Op.SET_ARGUMENT, a.canonical])
		);

	return ([
		Op.LOCATION, start, end,
		Op.LABEL, this.name.canonical,
		Op.STACK_ALLOC, this.meta.locals.length,
	]).concat(args).concat(this.statements.flatMap(s => s.emit())).concat([
		Op.LOCATION, start, end,
		Op.STACK_FREE, this.meta.locals.length,
		Op.RETURN
	])
	.concat(this.definitions.flatMap(d => d.emit()));
};

AST.Statement.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	switch (this.canonical) {
		case 'paper': {
			if (this.args.length === 1) {
				return [Op.LOCATION, start, end, Op.REDRAW, Op.CONSTANT, 255]
					.concat(this.args[0].emit()).concat([
						Op.LOCATION, start, end,
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
					]);
			} else {
				return [Op.REDRAW].concat(this.args
					.flatMap(x => {
						return x.emit().concat([
							Op.LOCATION, start, end,
							Op.CONSTANT, 0,
							Op.CONSTANT, 100,
							Op.CLAMP,
							Op.CONSTANT, 255,
							Op.MULTIPLY,
							Op.CONSTANT, 100,
							Op.DIVIDE
						])
					})).concat([Op.LOCATION, start, end, Op.PACK_RGB, Op.FILL_CANVAS]);
			}
		}
		case 'pen': {
			if (this.args.length === 1) {
				let rvalue = this.args[0].emit();

				if (this.args[0].meta.type === 'vector') {
					rvalue.push(Op.READ_PIXEL);
				}

				return [Op.LOCATION, start, end, Op.CONSTANT, 255].concat(rvalue).concat([
					Op.LOCATION, start, end,
					Op.CONSTANT, 0,
					Op.CONSTANT, 100,
					Op.CLAMP,
					Op.CONSTANT, 255,
					Op.MULTIPLY,
					Op.CONSTANT, 100,
					Op.DIVIDE,
					Op.SUBTRACT,
					Op.PACK_GRAY,
					Op.SET_PEN_COLOR
				]);
			} else {
				return this.args
					.map(x => {
						return x.emit().concat([
							Op.LOCATION, start, end,
							Op.CONSTANT, 0,
							Op.CONSTANT, 100,
							Op.CLAMP,
							Op.CONSTANT, 255,
							Op.MULTIPLY,
							Op.CONSTANT, 100,
							Op.DIVIDE
						])
					}).reduce((a, b) => a.concat(b), [])
					.concat([Op.LOCATION, start, end, Op.PACK_RGB, Op.SET_PEN_COLOR]);
			}
		}
		case 'set': {
			if (this.args[0].meta.type === 'vector') {
				// we're setting a pixel. We don't want to change the pen color
				let lvalue = this.args[0].emit();
				let rvalue = this.args[1].emit();

				if (this.args[1].meta.type === 'vector') {
					return lvalue.concat(rvalue).concat([
						Op.LOCATION, start, end,
						Op.READ_PIXEL,
						Op.UNPACK_GRAY,
						Op.PACK_GRAY,
						Op.WRITE_PIXEL]);
				} else {
					return lvalue.concat([Op.LOCATION, start, end, Op.CONSTANT, 255])
						.concat(rvalue)
						.concat([
							Op.LOCATION, start, end,
							Op.CONSTANT, 0,
							Op.CONSTANT, 100,
							Op.CLAMP,
							Op.CONSTANT, 255,
							Op.MULTIPLY,
							Op.CONSTANT, 100,
							Op.DIVIDE,
							Op.SUBTRACT,
							Op.PACK_GRAY,
							Op.WRITE_PIXEL
					]);
				}
			} else if (this.args[0].meta.type === 'connector') {
				// The statement is in the form Set <Array 0> 100
				const gen = this.args[0];
				return gen.args.flatMap(a => a.emit())
					.concat(this.args[1].emit())
					.concat([
						Op.LOCATION, start, end,
						Op.STACK_ALLOC, gen.args.length + 1,
						Op.CALL, gen.canonical + '_set',
						Op.STACK_FREE, gen.args.length + 1,
						Op.POP
					]);
			} else {
				let rvalue = this.args[1].emit();

				if (this.args[1].meta.type === 'vector') {
					rvalue = rvalue.concat([Op.READ_PIXEL, Op.UNPACK_GRAY]);
				}

				if (this.args[0].meta.argument === true || this.args[0].meta.bound === false) {
					return rvalue.concat([Op.SET_ARGUMENT, this.args[0].canonical]);
				} else {
					return rvalue.concat([Op.SET_LOCAL, this.args[0].canonical]);
				}
			}
		}
		case 'line': {
			return this.args.flatMap(a => a.emit())
				.concat([
					Op.LOCATION, start, end,
					Op.STACK_ALLOC, 4,
					Op.CALL, 'line',
					Op.STACK_FREE, 4,
					Op.POP
				]);
		}
		case 'value': {
			// TODO: This is essentially a return statement but it kind of
			// has to go at the end of the function definition.
			return this.args[0].emit();
			/*
			.concat([
				Op.STACK_FREE, 0,
				Op.RETURN
			]);*/
		}
		case 'refresh': {
			return [Op.LOCATION, start, end, Op.REDRAW];
		}
		default: {
			// At this point all we're left with are function calls I guess
			// TODO: attach the command implementation here.
			// If there's no implementation, it's a builtin and nothing is unbound
			let outers = this.meta.command ? this.meta.command.meta.unbound : [];

			return [Op.LOCATION, start, end]
				.concat(outers.flatMap(id => [Op.SET_OUTER, id]))
				.concat(this.args.flatMap(a => a.emit()))
				.concat([
					Op.LOCATION, start, end,
					Op.STACK_ALLOC, this.args.length,
					Op.CALL, this.canonical,
					Op.STACK_FREE, this.args.length,
					Op.POP
				])
				.concat(outers.slice(0).reverse().flatMap(id => [Op.GET_OUTER, id]));
		}
	}
};

AST.Generator.prototype.emit = function(ctx) {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return this.args.flatMap(a => a.emit())
		.concat([
			Op.LOCATION, start, end,
			Op.STACK_ALLOC, this.args.length,
			Op.CALL, this.canonical,
			Op.STACK_FREE, this.args.length
		]);
};

AST.Identifier.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	if (this.meta.argument === true || this.meta.bound === false) {
		return [Op.LOCATION, start, end, Op.GET_ARGUMENT, this.canonical];
	} else {
		return [Op.LOCATION, start, end, Op.GET_LOCAL, this.canonical];
	}
};

AST.Integer.prototype.emit = function() {
	const start = this.meta.start.offset;
	const end = this.meta.end.offset;

	return [Op.LOCATION, start, end, Op.CONSTANT, this.value];
};

AST.Vector.prototype.emit = function() {
	return this.values.flatMap((x) => x.emit());
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
	
	return this.lhs.emit()
		.concat(this.rhs.emit())
		.concat(Op.LOCATION, start, end, opcodes[this.operator]);
};

AST.Comment.prototype.emit = function() { return []; }

export default AST;

