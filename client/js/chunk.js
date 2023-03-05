import * as Op from './opcodes';

const Chunk = function (code, data, options) {
    options = options || { exports: null, locations: null, label: null };
    this.label = options.label;
    this.exports = options.exports || [];
    this.code = new Uint8Array(code);
    this.data = new Int32Array(data);
};

Chunk.prototype.disassemble = function () {
    const instrs = [];
    const addrs = [];
    const offsets = {};
    const labels = {};
    const locs = [0, 0];
    const exps = this.exports.map((func) => func.name);

    for (let i = 0, len = this.code.length; i < len; i++) {
        addrs.push(String('    ' + i.toString()).slice(-4));
        switch (this.code[i]) {
            case Op.CONSTANT: {
                offsets[i] = instrs.length;
                let idx = this.code[++i] & 0x7f;

                for (; (this.code[i] & 0x80) !== 0; i++) {
                    idx = idx << 7;
                    idx |= this.code[i + 1] & 0x7f;
                }

                instrs.push('\tCONSTANT ' + this.data[idx]);
                break;
            }
            case Op.GET_ARGUMENT: {
                offsets[i] = instrs.length;
                const idx = this.code[++i];
                instrs.push('\tGET_ARGUMENT ' + idx);
                break;
            }
            case Op.SET_ARGUMENT: {
                offsets[i] = instrs.length;
                const idx = this.code[++i];
                instrs.push('\tSET_ARGUMENT ' + idx);
                break;
            }
            case Op.GET_LOCAL: {
                offsets[i] = instrs.length;
                const idx = this.code[++i];
                instrs.push('\tGET_LOCAL ' + idx);
                break;
            }
            case Op.SET_LOCAL: {
                offsets[i] = instrs.length;
                const idx = this.code[++i];
                instrs.push('\tSET_LOCAL ' + idx);
                break;
            }

            case Op.ADD: {
                offsets[i] = instrs.length;
                instrs.push('\tADD');
                break;
            }
            case Op.SUBTRACT: {
                offsets[i] = instrs.length;
                instrs.push('\tSUBTRACT');
                break;
            }
            case Op.MULTIPLY: {
                offsets[i] = instrs.length;
                instrs.push('\tMULTIPLY');
                break;
            }
            case Op.DIVIDE: {
                offsets[i] = instrs.length;
                instrs.push('\tDIVIDE');
                break;
            }
            case Op.REMAINDER: {
                offsets[i] = instrs.length;
                instrs.push('\tREMAINDER');
                break;
            }
            case Op.NEGATE: {
                offsets[i] = instrs.length;
                instrs.push('\tNEGATE');
                break;
            }

            case Op.DUPLICATE: {
                offsets[i] = instrs.length;
                instrs.push('\tDUPLICATE');
                break;
            }
            case Op.POP: {
                offsets[i] = instrs.length;
                instrs.push('\tPOP');
                break;
            }

            case Op.SET_PEN_COLOR: {
                offsets[i] = instrs.length;
                instrs.push('\tSET_PEN_COLOR');
                break;
            }
            case Op.READ_PIXEL: {
                offsets[i] = instrs.length;
                instrs.push('\tREAD_PIXEL');
                break;
            }
            case Op.WRITE_PIXEL: {
                offsets[i] = instrs.length;
                instrs.push('\tWRITE_PIXEL');
                break;
            }
            case Op.FILL_PIXEL: {
                offsets[i] = instrs.length;
                instrs.push('\tFILL_PIXEL');
                break;
            }
            case Op.FILL_CANVAS: {
                offsets[i] = instrs.length;
                instrs.push('\tFILL_CANVAS');
                break;
            }
            case Op.REDRAW: {
                offsets[i] = instrs.length;
                instrs.push('\tREDRAW');
                break;
            }
            case Op.CLAMP: {
                offsets[i] = instrs.length;
                instrs.push('\tCLAMP');
                break;
            }
            case Op.PACK_GRAY: {
                offsets[i] = instrs.length;
                instrs.push('\tPACK_GRAY');
                break;
            }
            case Op.PACK_RGB: {
                offsets[i] = instrs.length;
                instrs.push('\tPACK_RGB');
                break;
            }
            case Op.PACK_RGBA: {
                offsets[i] = instrs.length;
                instrs.push('\tPACK_RGBA');
                break;
            }
            case Op.UNPACK_GRAY: {
                offsets[i] = instrs.length;
                instrs.push('\tUNPACK_GRAY');
                break;
            }
            case Op.UNPACK_RGB: {
                offsets[i] = instrs.length;
                instrs.push('\tUNPACK_RGB');
                break;
            }
            case Op.UNPACK_RGBA: {
                offsets[i] = instrs.length;
                instrs.push('\tUNPACK_RGBA');
                break;
            }

            case Op.JUMP: {
                offsets[i] = instrs.length;
                const high = this.code[++i];
                const low = this.code[++i];
                const offset = (high << 8) | low;

                if (labels.hasOwnProperty(offset)) {
                    labels[offset].push(instrs.length);
                } else {
                    labels[offset] = [instrs.length];
                }

                instrs.push('\tJUMP ');
                break;
            }
            case Op.JUMP_IF_NEGATIVE: {
                offsets[i] = instrs.length;
                const high = this.code[++i];
                const low = this.code[++i];
                const offset = (high << 8) | low;

                if (labels.hasOwnProperty(offset)) {
                    labels[offset].push(instrs.length);
                } else {
                    labels[offset] = [instrs.length];
                }

                instrs.push('\tJUMP_IF_NEGATIVE ');
                break;
            }
            case Op.JUMP_IF_NONNEGATIVE: {
                offsets[i] = instrs.length;
                const high = this.code[++i];
                const low = this.code[++i];
                const offset = (high << 8) | low;

                if (labels.hasOwnProperty(offset)) {
                    labels[offset].push(instrs.length);
                } else {
                    labels[offset] = [instrs.length];
                }

                instrs.push('\tJUMP_IF_NONNEGATIVE ');
                break;
            }
            case Op.JUMP_IF_ZERO: {
                offsets[i] = instrs.length;
                const high = this.code[++i];
                const low = this.code[++i];
                const offset = (high << 8) | low;

                if (labels.hasOwnProperty(offset)) {
                    labels[offset].push(instrs.length);
                } else {
                    labels[offset] = [instrs.length];
                }

                instrs.push('\tJUMP_IF_ZERO ');
                break;
            }
            case Op.JUMP_IF_NONZERO: {
                offsets[i] = instrs.length;
                const high = this.code[++i];
                const low = this.code[++i];
                const offset = (high << 8) | low;

                if (labels.hasOwnProperty(offset)) {
                    labels[offset].push(instrs.length);
                } else {
                    labels[offset] = [instrs.length];
                }

                instrs.push('\tJUMP_IF_NONZERO ');
                break;
            }

            case Op.PAUSE: {
                offsets[i] = instrs.length;
                instrs.push('\tPAUSE ');
                break;
            }

            case Op.STACK_ALLOC: {
                offsets[i] = instrs.length;
                const count = this.code[++i];
                instrs.push('\tSTACK_ALLOC ' + count);
                break;
            }
            case Op.STACK_FREE: {
                offsets[i] = instrs.length;
                const count = this.code[++i];
                instrs.push('\tSTACK_FREE ' + count);
                break;
            }

            case Op.CALL: {
                offsets[i] = instrs.length;
                const high = this.code[++i];
                const low = this.code[++i];
                const offset = (high << 8) | low;

                if (labels.hasOwnProperty(offset)) {
                    labels[offset].push(instrs.length);
                } else {
                    labels[offset] = [instrs.length];
                }

                instrs.push('\tCALL ');
                break;
            }
            case Op.INVOKE: {
                offsets[i] = instrs.length;
                const arity = this.code[++i];
                const index = this.code[++i];

                if (index < 0 || index >= exps.length) {
                    throw {
                        message: 'host function index out of bounds',
                        start: locs[0],
                        end: locs[1],
                    };
                }

                const name = exps[index];
                instrs.push('\tINVOKE ' + arity + ' ' + name);
                break;
            }
            case Op.RETURN: {
                addrs.push('    ');
                offsets[i] = instrs.length;
                instrs.push('\tRETURN');
                offsets[i] = instrs.length;
                instrs.push('\t----------');
                break;
            }
            case Op.LOCATION_PUSH: {
                //offsets[i] = instrs.length;
                const start = this.data[this.code[++i]];
                const end = this.data[this.code[++i]];
                locs[0] = start;
                locs[1] = end;
                instrs.push('\tLOCATION_PUSH ' + start + ' ' + end);
                break;
            }
            case Op.LOCATION_POP: {
                instrs.push('\tLOCATION_POP');
                break;
            }
            case Op.HALT: {
                addrs.push('    ');
                offsets[i] = instrs.length;
                instrs.push('\tHALT');
                offsets[i] = instrs.length;
                instrs.push('\t----------');
                break;
            }
            default: {
                const hex = this.code[i].toString(16).toUpperCase();
                throw {
                    message: 'unrecognized opcode 0x' + hex,
                    start: locs[0],
                    end: locs[1],
                };
            }
        }
    }

    let currentSymbol = 0;

    function gensym() {
        const sym = String('00' + (currentSymbol++).toString()).slice(-2);
        return sym.replace(/[0-9]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 17));
    }

    for (let offset in labels) {
        const symbol = gensym();
        const idx = offsets[offset];

        instrs[idx] = symbol + ':' + instrs[idx];
        for (let j of labels[offset]) {
            instrs[j] += ':' + symbol;
        }
    }

    for (let i = 0, len = instrs.length; i < len; i++) {
        instrs[i] = addrs[i] + '\t' + instrs[i];
    }

    return instrs.join('\n');
};

export default Chunk;
