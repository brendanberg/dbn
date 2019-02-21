import VM from './vm';
import AST from './ast';
import Timer from './timer';
import Canvas from './canvas';
import assemble from './assemble';
import parser from '../grammar/dbn.pegjs';


const DBN = function() {
	this.canvas = null;
	this.vm = null;
	this.running = false;
};

DBN.prototype.parser = parser;

DBN.prototype.init = function(paper) {
	this.canvas = new Canvas(paper);
	this.vm = new VM(this.canvas);
	this.vm.init();
	this.timer = new Timer();

	const self = this;
	let explainFlag = false;

	const start = e => {
		if (e.shiftKey) {
			explainFlag = true;
			const explain = self.vm.explainPixel(self.canvas.mouseX, self.canvas.mouseY);
			e.target.dispatchEvent(new CustomEvent('highlight', {detail: explain}));
		}
	};

	const explain = e => {
		if (!e.shiftKey) {
			explainFlag = false;
			return;
		}

		if (explainFlag) {
			const explain = self.vm.explainPixel(self.canvas.mouseX, self.canvas.mouseY);
			e.target.dispatchEvent(new CustomEvent('highlight', {detail: explain}));
		}
	};

	const cancel = e => {
		explainFlag = false;
		const none = {start: {offset: 0}, end: {offset: 0}};
		e.target.dispatchEvent(new CustomEvent('highlight', {detail: none}));
	}

	paper.addEventListener('mousedown', start, false);
	paper.addEventListener('mousemove', explain, false);
	paper.addEventListener('mouseup', cancel, false);
};

DBN.prototype.run = function(source, callback) {
	if (this.running) {
		this.stop();
	}

	let timer = new Timer();
	timer.start();

	let ast;
	try {
		ast = this.parser.parse(source);
	} catch (err) {
		gtag('event', 'Compilation Error', {event_category: 'Compile Sketch'});

		if (err.expected && err.found) {
			let message;
			const exp = Object.keys(err.expected
					.filter(x => x.hasOwnProperty('description') && x.description.length)
					.map(x => x.description)
					.reduce((map, item) => map[item] = true, {})
				).concat(err.expected.filter(x => x.hasOwnProperty('text'))
				.map(x => '"' + x.text + '"'));

			console.log(exp);

			if (exp.length === 2) {
				message = 'expected ' + exp.join(' or ') + ' but encountered "' + err.found + '"';
			} else if (exp.length !== 0) {
				exp[exp.length - 1] = 'or ' + exp[exp.length - 1];
				message = 'expected ' + exp.join(', ') + ' but encountered "' + err.found + '"';
			} else {
				message = 'encountered unexpected "' + err.found + '"';
			}

			throw {
				message: message,
				start: err.location.start,
				end: err.location.end
			};
		} else {
			//message = err.message;
			throw err;
			({
				message: err.message || 'unidentified parse error',
				start: err.location.start,
				end: err.location.end
			});
		}

	}

	// Remove comment nodes from the AST
	const removeComments = node => {
		if (node.hasOwnProperty('statements')) {
			node.statements = node.statements.filter(s => s.meta.type !== 'comment');
		}

		return [node, true];
	};

	// Transform STATEMENT, BLOCK sequences into COMMAND[ BLOCK ] nodes
	const commandTransform = node => {
		if (node.hasOwnProperty('statements')) {
			const newStatements = [];

			for (let i = 0, len = node.statements.length; i < len; i++) {
				const stmnt = node.statements[i];

				if (stmnt.meta.type === 'statement') {
					const invalidArgs = stmnt.args.filter(x => 
							AST.reservedWords.includes(x.canonical));

					if (invalidArgs.length) {
						throw {
							message: ('the word "' + args[0].canonical +
								'" cannot be used as a variable name'),
							start: args[0].meta.start,
							end: args[0].meta.end
						}
					}

					if (AST.controlFlow.hasOwnProperty(stmnt.canonical)) {
						if (i === node.statements.length - 1 ||
								node.statements[i + 1].meta.type !== 'block') {
							throw {
								message: "'" + stmnt.name + "' statements must be followed by a block",
								start: stmnt.meta.start,
								end: stmnt.meta.end
							};
						}

						const body = node.statements[++i];
						const builder = AST.controlFlow[stmnt.canonical];

						newStatements.push(builder(stmnt, body).transform(commandTransform));
					} else {
						newStatements.push(stmnt);
					}
				} else {
					newStatements.push(stmnt);
				}
			}

			node.statements = newStatements;
			return [node, false];
		}

		return [node, true];
	};

	const argumentTransform = node => {
		if (node.meta.type === 'command' || node.meta.type === 'number') {
			// TODO: Push a scope?
			const args = node.args.map(arg => arg.canonical);

			const scanArguments = n => {
				if (n.meta.type === 'identifier') {
					if (args.includes(n.canonical)) {
						n.meta.argument = true;
					}

					return [n, false];
				} else if (n.meta.type === 'command' || n.meta.type === 'number') {
					return [n.transform(argumentTransform), false];
				} else {
					return [n, true];
				}
			};

			node.statements = node.statements.map(s => s.transform(scanArguments));
			return [node, false];
		} else {
			return [node, true];
		}
	};

	// TODO: This should happen after definition reordering
	const bindTransform = node => {
		const locals = {};
		const unbound = [];

		const resolveLocals = n => {
			if (n.meta.type === 'statement') { 
				if (n.canonical === 'set') {
					if (!unbound.includes(n.args[0].canonical)) {
						locals[n.args[0].canonical] = true;
						n.args[0].meta.bound = true;
					}
				}

				n.args.map(arg => arg.transform(resolveLocals));
				return [n, false];
			} else if (n.meta.type === 'loop' && n.iterator) {
				locals[n.iterator.canonical] = true;
				console.log('before resolving loop', locals);
				n.statements.map(s => s.transform(resolveLocals));
				console.log('after resolving loop', locals);
				return [n, false];
			} else if (n.meta.type === 'identifier') {
				if (!(n.meta.argument || locals.hasOwnProperty(n.canonical))) {
					if (!unbound.includes(n.canonical)) {
						unbound.push(n.canonical);
					}
				} else if (!unbound.includes(n.canonical)) {
					// TODO: Test whether this works better as locals.hasOwnProperty
					n.meta.bound = true;
				}
				return [n, false];
			} else if (n.meta.type === 'command' || n.meta.type === 'number') {
				// By recurring with bindTransform, you get a new context for
				// local and unbound variables.
				return [n.transform(bindTransform), false];
			} else {
				return [n, true];
			}
		};

		if (node.meta.type === 'program' || node.meta.type === 'command' || node.meta.type === 'number') {
			node.statements = node.statements.map(st => st.transform(resolveLocals));
			node.meta.unbound = unbound;
			return [node, false];
		} else {
			return [node, true];
		}
	};

	const orderingTransform = node => {
		if (node.meta.type === 'program' || node.meta.type === 'command' || node.meta.type === 'number' || node.meta.type === 'loop') {
			const statements = [];
			const defns = [];
			const locals = {};

			//for (let i = 0, len = node.statements.length; i < len; i++) {
			//	let stmnt = node.statements[i];

			const orderingHelper = n => {
				if (n.meta.type === 'command' || n.meta.type === 'number') {
					let definition = n.transform(orderingTransform);
					defns.push(definition);
					definition.outerDefns = defns;
				} else if (n.meta.type === 'statement' && n.canonical === 'set'
						&& n.args[0].meta.type === 'identifier'
						&& (n.args[0].meta.argument === false || n.args[0].meta.bound === true)) {

					locals[n.args[0].canonical] = true;
					statements.push(n);
				} else if (n.meta.type === 'loop') {
					let loop = n.transform(orderingTransform);

					if (n.iterator) {
						locals[n.iterator.canonical] = true;
						locals[n.iterator.canonical + '$0'] = true;
					}

					let inners = n.statements.filter(s => {
						return (s.meta.type === 'loop'
								|| s.meta.type === 'statement' && s.canonical === 'paper');
					});

					//n.statements.map(s => s.transform(orderingTransform));//orderingHelper));
					
					for (let a of loop.locals) {
						locals[a] = true;
					}

					statements.push(loop);
				} else if (n.meta.type === 'condition') {
					//n.statements.map(s => s.transform(orderingTransform));
					let condition = n.transform(orderingTransform);

					for (let a of condition.locals) {
						locals[a] = true;
					}

					statements.push(n);
				} else {
					statements.push(n);
				}

				return [n, false];
			};

			node.statements.map(s => s.transform(orderingHelper));

			node.locals = Object.keys(locals);
			node.statements = statements;
			node.defns = defns;
			return [node, false];
		} else {
			return [node, true];
		}
	};

	const resolveFunctions = node => {
		// TODO: I think this only resolves the top level.
		// TODO: We also need to resolve connectors
		if (node.meta.type === 'program' || node.meta.type === 'command') {
			console.log('resolving ' + (node.name ? node.name.canonical : 'program') + '...', node.defns);

			let defns = node.defns.map(x => [x.name.canonical, x.args.length])
				.concat(node.outerDefns.map(x => [x.name.canonical, x.args.length]))
				.reduce((map, def) => {
					if (map.hasOwnProperty(def[0])) {
						map[def[0]].push(def[1]);
					} else {
						map[def[0]] = [def[1]];
					}

					return map;
				}, Object.assign({}, AST.commands));

			let commands = node.defns.slice(0)
				.concat(node.outerDefns)
				.reduce((map, cmd) =>
					Object.assign(map, {[cmd.name.canonical]: cmd}), {});
				// AST.commands.reduce((map, cmd) => new Command(cmd.name, ...))

			const resolveHelper = n => {
				if (n.meta.type === 'statement') {
					if (!defns.hasOwnProperty(n.canonical)) {
						throw {
							message: 'could not find a command called "' + n.canonical + '"',
							start: n.meta.start,
							end: n.meta.end
						};
					} else if (!defns[n.canonical].includes(n.args.length)) {
						let arity = defns[n.canonical][0];
						throw {
							message: ('"' + n.canonical + '" commands require '
								+ arity + ' parameter' + ((arity === 1) ? '' : 's')
								+ '; found ' + n.args.length),
							start: n.meta.start,
							end: n.meta.end
						};
					}
					console.log('successfully bound call to ' + n.canonical);
					n.meta.command = commands[n.canonical];
					return [n, false];
				} else if (n.meta.type === 'loop' || n.meta.type === 'condition') {
					return [n, true];
				} else if (n.meta.type === 'command' || n.meta.type === 'number') {
					//n.outerDefns = defns;
					return [n.transform(resolveFunctions), false];
				} else {
					return [n, true];
				}// TODO: add conditions for command and number definitions
			};

			node.statements.map(s => s.transform(resolveHelper));
			node.defns.map(d => d.transform(resolveHelper));
			return [node, false];
		} else {
			return [node, true];
		}
	};

	ast = ast.applyTransformations([
			removeComments, commandTransform, argumentTransform, bindTransform,
			orderingTransform, resolveFunctions
	]);
	console.log(ast);


	const self = this;

	ast.exports.push(function mouse(a) { 
		switch (a) {
			case 1:
				return self.canvas.mouseX;
			case 2:
				return self.canvas.mouseY;
			case 3:
				console.log(self.canvas.mouseDown);
				return self.canvas.mouseDown ? 100 : 0;
			default:
				return 0;
		}
	});

	const _array = new Int32Array(1000);

	ast.exports.push(function array(idx) {
		return _array[idx + 1];
	});

	ast.exports.push(function array_set(idx, val) {
		_array[idx + 1] = val;
	});

	ast.exports.push(function time(which) {
		const now = new Date();

		switch (which) {
			// 1 = hour, 2 = minute, 3 = second, and 4 = millisecond.
			case 1:
				return now.getHours();
			case 2:
				return now.getMinutes();
			case 3:
				return now.getSeconds();
			case 4:
				return now.getMilliseconds();
			default:
				return 0;
		}
	});

	const chunk = assemble(null, ast.emit(), ast.exports);
	console.log('%c' + chunk.disassemble(), 'font-family:"Source Code Pro",monospace;');

	timer.stop();

	gtag('event', 'timing_complete', {
		event_category: 'Compile Sketch',
		event_label: 'Compile Time',
		non_interaction: true,
		value: timer.elapsed() / 1000
	});

	this.timer.start();
	this.vm.init(chunk);
	this.running = true;
	this.step();
	
	if (callback && typeof(callback) === 'function') {
		this.callback = callback;
	}
};

DBN.prototype.step = function() {
	this.vm.run();

	if (this.vm.completed) {
		this.timer.stop();

		gtag('event', 'timing_complete', {
			event_category: 'Execute Sketch',
			event_label: 'Execution Time',
			non_interaction: true,
			value: this.elapsed() / 1000
		});

		this.timer.reset();
		if (cancelAnimationFrame) { cancelAnimationFrame(this.requestID); }
		if (this.callback) { this.callback(); }
	} else {
		const self = this;
		this.requestID = (requestAnimationFrame || (cb => setInterval(cb, this.canvas.frameRate)))(
			self.step.bind(self)
		);
	}
};

DBN.prototype.stop = function() {
	this.running = false;
	this.timer.stop();

	gtag('event', 'timing_complete', {
		event_category: 'Execute Sketch',
		event_label: 'Execution Time',
		value: this.elapsed() / 1000
	});

	this.timer.reset();
	if (cancelAnimationFrame) { cancelAnimationFrame(this.requestID); }
};

DBN.prototype.elapsed = function() {
	return this.timer.elapsed();
};

export default DBN;

