import * as Op from './opcodes';
import Chunk from './chunk';


const assemble = function(label, assembly, exports) {
	const code = [];
	const data = [];

	const labels = {};
	const refs = [];
	const exps = (exports || []).map((func, i) => [func.name, i])
			.reduce((map, tup) => Object.assign({[tup[0]]: tup[1]}, map), {});

	let locals = [];
	let outers = [];
	let args = [];

	const locations = [];
	var index = 0;
	var start = 0;
	var end = 0;

	for (let i = 0, len = assembly.length; i < len; i++) {
		switch (assembly[i]) {
			case Op.LABEL: {
				// A label doesn't get assembled into the bytecode chunk;
				// we just add the location of the next instruction to
				// the label dictionary. 
				let label = assembly[++i];
				if (labels.hasOwnProperty(label)) {
					throw "redefinition of label '" + label + "'";
				}

				labels[label] = code.length;
				break;
			}
			case Op.LOCATION: {
				let newStart = assembly[++i];
				let newEnd = assembly[++i];

				if (index && start && end) {
					locations.push([index, start, end]);
				}

				index = code.length;
				start = newStart;
				end = newEnd;
				break;
			}
			case Op.ARGUMENT: {
				let arg = assembly[++i];

				if (args.indexOf(arg) !== -1) {
					throw "redefinition of argument '" + arg + "'";
				}

				args.push(arg);
				break;
			}
			case Op.CONSTANT: {
				code.push(assembly[i]);

				let value = assembly[++i];
				let idx = data.indexOf(value);

				if (idx !== -1) {
					code.push(idx);
				} else {
					code.push(data.length);
					data.push(value);
				}

				break;
			}
			case Op.GET_ARGUMENT: {
				code.push(assembly[i]);
				let name = assembly[++i];

				if (typeof name === 'number') {
					code.push(name);
				} else {
					let idx = args.indexOf(name);

					if (idx === -1) {
						console.error("unknown argument '" + name + "'");
						console.error('location ' + (i - 1));
					} else {
						code.push(idx);
					}
				}

				break;
			}
			case Op.SET_ARGUMENT: {
				code.push(assembly[i]);
				let name = assembly[++i];

				if (typeof name === 'number') {
					code.push(name);
				} else {
					let idx = args.indexOf(name);

					if (idx === -1) {
						args.push(name);
					} else {
						code.push(idx);
					}
				}

				break;
			}
			case Op.SET_LOCAL: {
				code.push(assembly[i]);
				let name = assembly[++i];
				let idx = locals.indexOf(name);

				if (idx === -1) {
					code.push(locals.length);
					locals.push(name);
				} else {
					code.push(idx);
				}

				break;
			}
			case Op.GET_LOCAL: {
				code.push(assembly[i]);
				let name = assembly[++i];
				let idx = locals.indexOf(name);
				
				if (idx === -1) {
					throw ('encountered unknown variable ' + name);
				} else {
					code.push(idx);
				}
				break;
			}
			case Op.SET_OUTER: {
				code.push(assembly[i]);
				let name = assembly[++i];
				let idx = locals.indexOf(name);

				if (idx === -1) {
					throw ('encountered unknown outer variable ' + name);
				} else {
					code.push(idx);
				}
				break;
			}
			case Op.GET_OUTER: {
				code.push(assembly[i]);
				let name = assembly[++i];
				let idx = locals.indexOf(name);
				
				if (idx === -1) {
					throw ('encountered unknown outer variable ' + name);
				} else {
					code.push(idx);
				}
				break;
			}
			case Op.CALL:
			case Op.JUMP:
			case Op.JUMP_IF_NEGATIVE:
			case Op.JUMP_IF_NONNEGATIVE:
			case Op.JUMP_IF_ZERO:
			case Op.JUMP_IF_NONZERO: {
				code.push(assembly[i]);
				let label = assembly[++i];
				refs.push([code.length, 2, label]);
				code.push(0, 0);
				break;
			}
			case Op.INVOKE: {
				code.push(assembly[i]);
				const arity = assembly[++i];
				const label = assembly[++i];

				if (exps.hasOwnProperty(label)) {
					code.push(arity);
					code.push(exps[label]);
				} else {
					throw 'encountered unknown function ' + label;
				}

				break;
			}
			case Op.STACK_ALLOC: {
				code.push(assembly[i]);
				code.push(assembly[++i]);
				//args = [];
				break;
			}
			case Op.STACK_FREE: {
				code.push(assembly[i]);
				code.push(assembly[++i]);
				break;
			}
			case Op.RETURN:
			case Op.HALT:
				locals = [];
				args = [];
			case Op.ADD:
			case Op.SUBTRACT:
			case Op.MULTIPLY:
			case Op.DIVIDE:
			case Op.REMAINDER:
			case Op.NEGATE:
			case Op.DUPLICATE:
			case Op.POP:
			case Op.SET_PEN_COLOR:
			case Op.READ_PIXEL:
			case Op.WRITE_PIXEL:
			case Op.FILL_PIXEL:
			case Op.FILL_CANVAS:
			case Op.REDRAW:
			case Op.CLAMP:
			case Op.PACK_GRAY:
			case Op.PACK_RGB:
			case Op.PACK_RGBA:
			case Op.UNPACK_GRAY:
			case Op.UNPACK_RGB:
			case Op.UNPACK_RGBA:
			case Op.RETURN: {
				// These are all zero-argument opcodes
				code.push(assembly[i]);
				break;
			}
			default:
				console.error('unexpected opcode ' + assembly[i], i);
				throw 'encountered unexpected opcode';
		}
	}

	for (let i = 0, len = refs.length; i < len; i++) {
		if (refs[i][1] === 2) {
			const idx = labels[refs[i][2]];
			const high = (idx & 0xFF00) >> 8;
			const low = idx & 0xFF;
			code[refs[i][0]] = high;
			code[refs[i][0] + 1] = low;
		} else {
			throw 'long addresses are not supported yet';
		}
	}

	return new Chunk(code, data, {
		label: label,
		exports: exports,
		locations: locations.slice(0).reverse()
	});
};

export default assemble;
