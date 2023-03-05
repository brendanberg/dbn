import VM from './vm';
import AST from './ast';
import Timer from './timer';
import Canvas from './canvas';
import assemble from './assemble';
import parser from '../grammar/dbn.pegjs';
import axios from 'axios';
import { VM_STATE_WAITING, VM_STATE_RUNNING, VM_STATE_PAUSED, VM_STATE_DONE, VM_STATE_ERROR } from './vm';

const DBN = function () {
    this.canvas = null;
    this.vm = null;
    this.running = false;
};

DBN.prototype.parser = parser;

DBN.prototype.init = function (paper) {
    this.canvas = new Canvas(paper);
    this.vm = new VM(this.canvas);
    this.vm.init();
    this.timer = new Timer();

    const self = this;
    let explainFlag = false;

    const zeroRange = { start: { offset: 0 }, end: { offset: 0 } };

    const explain = (e) => {
        if (self.vm.state === VM_STATE_ERROR || self.vm.state === VM_STATE_WAITING) {
            return;
        }

        if (e.shiftKey) {
            const explain = self.vm.explainPixel(self.canvas.mouseX, self.canvas.mouseY);
            e.target.dispatchEvent(new CustomEvent('highlight', { detail: explain }));
        } else {
            e.target.dispatchEvent(new CustomEvent('highlight', { detail: zeroRange }));
        }
    };

    const clear = (e) => {
        if (self.vm.state === VM_STATE_ERROR || self.vm.state === VM_STATE_WAITING) {
            return;
        }

        e.target.dispatchEvent(new CustomEvent('highlight', { detail: zeroRange }));
    };

    paper.addEventListener('mousemove', explain, false);
    paper.addEventListener('mouseleave', clear, false);
};

DBN.prototype.beautify = function (source, callback) {
    let ast;

    try {
        ast = this.parser.parse(source);
    } catch (err) {
        gtag('event', 'Parse Error', { event_category: 'Beautify Sketch' });

        if (err.expected && err.found) {
            let message;
            const exp = Object.keys(
                err.expected
                    .filter((x) => x.hasOwnProperty('description') && x.description.length)
                    .map((x) => x.description)
                    .reduce((map, item) => Object.assign({ [map[item]]: true }, map), {})
            ).concat(err.expected.filter((x) => x.hasOwnProperty('text')).map((x) => '"' + x.text + '"'));

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
                end: err.location.end,
            };
        } else {
            //message = err.message;
            throw err;
            ({
                message: err.message || 'unidentified parse error',
                start: err.location.start,
                end: err.location.end,
            });
        }
    }

    const vars = {};
    const cmds = {};

    const resolveIdentifiers = (node, outerMeta) => {
        if (node.meta.type === 'statement') {
            switch (node.canonical) {
                case 'Repeat':
                    vars[node.args[0].canonical] = node.args[0].name;
                    break;
                case 'Command':
                    cmds[node.args[0].canonical] = node.args[0].name;

                    for (let arg of node.args.slice(1)) {
                        if (!(arg in vars)) {
                            vars[arg.canonical] = arg.name;
                        }
                    }
                    break;
                case 'Number':
                    cmds[node.args[0].canonical] = node.args[0].name;

                    for (let arg of node.args.slice(1)) {
                        if (!(arg in vars)) {
                            vars[arg.canonical] = arg.name;
                        }
                    }

                    break;
                case 'Set':
                    if (node.args[0].meta.type === 'identifier') {
                        vars[node.args[0].canonical] = node.args[0].name;
                    }
                    break;
            }
        }

        return [node, true];
    };

    const updateIdentifiers = (node, outerMeta) => {
        if (node.meta.type === 'identifier') {
            node.name = vars[node.canonical] || node.name;
            return [node, false];
        } else if (node.meta.type === 'statement') {
            if (
                !(
                    node.canonical in AST.controlFlow ||
                    node.canonical in AST.connectors ||
                    node.canonical in AST.commands
                )
            ) {
                node.canonical = cmds[node.canonical] || node.name;
            }
            return [node, true];
        } else {
            return [node, true];
        }
    };

    ast = ast.applyTransformations([resolveIdentifiers, updateIdentifiers]);

    if (callback && typeof callback === 'function') {
        this.callback = callback;
    }

    return ast.indent(0);
};

DBN.prototype.run = async function (source) {
    if (this.running) {
        this.stop();
    }

    this.canvas.init();

    const evt = new CustomEvent('vmstart', {});
    window.dispatchEvent(evt);

    const timer = new Timer();
    timer.start();

    let ast;
    try {
        ast = this.parser.parse(source);
    } catch (err) {
        gtag('event', 'Compilation Error', { event_category: 'Compile Sketch' });

        if (err.expected && err.found) {
            let message;
            const exp = Object.keys(
                err.expected
                    .filter((x) => x.hasOwnProperty('description') && x.description.length)
                    .map((x) => x.description)
                    .reduce((map, item) => Object.assign({ [map[item]]: true }, map), {})
            ).concat(err.expected.filter((x) => x.hasOwnProperty('text')).map((x) => '"' + x.text + '"'));

            console.log(err);

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
                end: err.location.end,
            };
        } else {
            //message = err.message;
            throw err;
            ({
                message: err.message || 'unidentified parse error',
                start: err.location.start,
                end: err.location.end,
            });
        }
    }

    // Remove comment nodes from the AST
    const removeComments = (node) => {
        if (node.hasOwnProperty('statements')) {
            node.statements = node.statements.filter((s) => s.meta.type !== 'comment');
        }

        return [node, true];
    };

    // Transform STATEMENT, BLOCK sequences into COMMAND[ BLOCK ] nodes
    const commandTransform = (node) => {
        if (node.hasOwnProperty('statements')) {
            const newStatements = [];

            for (let i = 0, len = node.statements.length; i < len; i++) {
                const stmnt = node.statements[i];

                if (stmnt.meta.type === 'statement') {
                    const invalidArgs = stmnt.args.filter((x) => AST.reservedWords.includes(x.canonical));

                    if (invalidArgs.length) {
                        throw {
                            message: 'the word "' + args[0].canonical + '" cannot be used as a variable name',
                            start: args[0].meta.start,
                            end: args[0].meta.end,
                        };
                    }

                    if (AST.controlFlow.hasOwnProperty(stmnt.canonical)) {
                        if (i === node.statements.length - 1 || node.statements[i + 1].meta.type !== 'block') {
                            throw {
                                message: "'" + stmnt.name + "' statements must be followed by a block",
                                start: stmnt.meta.start,
                                end: stmnt.meta.end,
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

    const resolveIdentifiers = (node, outerMeta) => {
        if (node.meta.type === 'program' || node.meta.type === 'command' || node.meta.type === 'number') {
            // Bookkeeping on `program`, `command`, and `number` nodes consists
            // of collecting parameter names, separating inner definitions from
            // body statements, etc.

            node.meta.args = node.args.map((arg) => arg.canonical);
            node.args = node.args.map((arg) => {
                arg.meta.argument = true;
                return arg;
            });

            let commands = node.statements.filter((s) => s.meta.type === 'command');
            let numbers = node.statements.filter((s) => s.meta.type === 'number');

            let outerCommands = outerMeta ? outerMeta.commands : AST.commands;
            let outerNumbers = outerMeta ? outerMeta.numbers : AST.connectors;

            node.meta.commands = commands
                .map((cmd) => [
                    cmd.name.canonical,
                    {
                        arity: [cmd.args.length],
                        unbound: [],
                    },
                ])
                .reduce((map, elt) => Object.assign({ [elt[0]]: elt[1] }, map), outerCommands);

            node.meta.numbers = numbers
                .map((num) => [
                    num.name.canonical,
                    {
                        arity: [num.args.length],
                        unbound: [],
                    },
                ])
                .reduce((map, elt) => Object.assign({ [elt[0]]: elt[1] }, map), outerNumbers);

            commands = commands.map((c) => {
                c = c.transform(resolveIdentifiers, node.meta);
                Array.prototype.push.apply(node.meta.commands[c.name.canonical].unbound, c.meta.unbound);
                return c;
            });

            numbers = numbers.map((n) => {
                n = n.transform(resolveIdentifiers, node.meta);
                Array.prototype.push.apply(node.meta.numbers[n.name.canonical].unbound, n.meta.unbound);
                return n;
            });

            node.statements = node.statements
                .filter((s) => s.meta.type !== 'command' && s.meta.type !== 'number')
                .map((s) => s.transform(resolveIdentifiers, node.meta));

            node.definitions = commands.concat(numbers);
            return [node, false];
        } else if (node.meta.type === 'loop') {
            // If we encounter a `loop` node, push the loop iterator variable
            // name into locals and recursively descend into each statement
            if (node.iterator && node.start && node.stop) {
                const name = node.iterator.canonical;

                if (!outerMeta.unbound.includes(name)) {
                    if (outerMeta.args.includes(name)) {
                        node.iterator.meta.argument = true;
                    } else if (!outerMeta.locals.includes(name)) {
                        outerMeta.locals.push(name);
                        node.iterator.meta.bound = true;
                    }
                }

                node.start = node.start.transform(resolveIdentifiers, outerMeta);
                node.stop = node.stop.transform(resolveIdentifiers, outerMeta);
            }
            node.statements = node.statements.map((s) => s.transform(resolveIdentifiers, outerMeta));
            return [node, false];
        } else if (node.meta.type === 'condition') {
            // TODO: Can this simply be handled by the default recursive case?
            node.predicate = node.predicate.transform(resolveIdentifiers, outerMeta);
            node.statements = node.statements.map((s) => s.transform(resolveIdentifiers, outerMeta));
            return [node, false];
        } else if (node.meta.type === 'identifier') {
            if (outerMeta.args.includes(node.canonical)) {
                node.meta.argument = true;
            } else if (outerMeta.locals.includes(node.canonical)) {
                node.meta.bound = true;
            } else if (!outerMeta.unbound.includes(node.canonical)) {
                // The current identifier is unbound. Push it into the unbound list
                outerMeta.unbound.push(node.canonical);
            }
            return [node, false];
        } else if (node.meta.type === 'statement') {
            // We have the enclosing
            if (node.canonical === 'Set') {
                if (node.args.length != 2) {
                    throw {
                        message: '"Set" requires two parameters',
                        start: node.meta.start,
                        end: node.meta.end,
                    };
                }
                if (node.args[0].meta.type === 'identifier') {
                    // Handle a normal l-value
                    const name = node.args[0].canonical;

                    if (!outerMeta.unbound.includes(name)) {
                        if (outerMeta.args.includes(name)) {
                            node.args[0].meta.argument = true;
                        } else {
                            if (!outerMeta.locals.includes(name)) {
                                outerMeta.locals.push(name);
                            }
                            node.args[0].meta.bound = true;
                        }
                    }
                } else if (node.args[0].meta.type === 'vector' || node.args[0].meta.type === 'connector') {
                    // Handle a vector or generator
                    node.args[0] = node.args[0].transform(resolveIdentifiers, outerMeta);
                    node.args[0].meta.lvalue = true;
                } else {
                    throw {
                        message: '"Set" expects a variable name, pixel, or connector as its first parameter',
                        start: node.args[0].meta.start,
                        end: node.args[0].meta.end,
                    };
                }

                node.args = node.args
                    .slice(0, 1)
                    .concat(node.args.slice(1).map((n) => n.transform(resolveIdentifiers, outerMeta)));

                return [node, false];
            } else {
                if (!outerMeta.commands.hasOwnProperty(node.canonical)) {
                    throw {
                        message: 'could not find a command called "' + node.canonical + '"',
                        start: node.meta.start,
                        end: node.meta.end,
                    };
                } else if (!outerMeta.commands[node.canonical].arity.includes(node.args.length)) {
                    const arity = outerMeta.commands[node.canonical].arity[0];

                    throw {
                        message:
                            '"' +
                            node.canonical +
                            '" commands expect ' +
                            arity +
                            ' parameter' +
                            (arity === 1 ? '' : 's') +
                            '; found ' +
                            node.args.length,
                        start: node.meta.start,
                        end: node.meta.end,
                    };
                }

                node.args = node.args.map((n) => n.transform(resolveIdentifiers, outerMeta));
                node.meta.unbound = outerMeta.commands[node.canonical].unbound;

                for (let name of node.meta.unbound) {
                    if (!outerMeta.unbound.includes(name)) {
                        outerMeta.unbound.push(name);
                    }
                }

                return [node, false];
            }
        } else if (node.meta.type === 'connector') {
            if (!outerMeta.numbers.hasOwnProperty(node.canonical)) {
                throw {
                    message: 'could not find a definition for "' + node.canonical + '"',
                    start: node.meta.start,
                    end: node.meta.end,
                };
            } else if (!outerMeta.numbers[node.canonical].arity.includes(node.args.length)) {
                const arity = outerMeta.numbers[node.canonical].arity[0];

                throw {
                    message:
                        '"' +
                        node.canonical +
                        '" expect ' +
                        arity +
                        ' parameter' +
                        (arity === 1 ? '' : 's') +
                        '; found ' +
                        node.args.length,
                    start: node.meta.start,
                    end: node.meta.end,
                };
            }

            node.args = node.args.map((n) => n.transform(resolveIdentifiers, outerMeta));
            node.meta.unbound = outerMeta.numbers[node.canonical].unbound;

            for (let name of node.meta.unbound) {
                if (!outerMeta.unbound.includes(name)) {
                    outerMeta.unbound.push(name);
                }
            }

            return [node, false];
        } else {
            return [node, true];
        }
    };

    ast = ast.applyTransformations([removeComments, commandTransform, resolveIdentifiers]);

    const self = this;

    ast.exports.push(async function Mouse(a) {
        switch (a) {
            case 1:
                return self.canvas.mouseX;
            case 2:
                return self.canvas.mouseY;
            case 3:
                return self.canvas.mouseDown ? 100 : 0;
            default:
                return 0;
        }
    });

    ast.exports.push(async function Key(a) {
        return 0;
    });

    ast.exports.push(async function Net(idx) {
        const response = await axios.get('https://dbn.berg.industries/api.v1/net/' + idx);

        if ([200, 304].includes(response.status)) {
            console.log(response.data);
            return parseInt(response.data, 10);
        } else {
            return 0;
        }
        // TODO: Catch error
    });

    ast.exports.push(async function Net_set(idx, val) {
        const response = await axios.put('https://dbn.berg.industries/api.v1/net/' + idx, val.toString());

        if ([200, 304].includes(response.status)) {
            return parseInt(response.data, 10);
        } else {
            return 0;
        }
    });

    const _array = new Int32Array(1000);

    ast.exports.push(async function Array(idx) {
        return _array[idx - 1];
    });

    ast.exports.push(async function Array_set(idx, val) {
        _array[idx - 1] = val;
    });

    ast.exports.push(async function Time(which) {
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
    //console.log('%c' + chunk.disassemble(), 'font-family:"Source Code Pro",monospace;');

    timer.stop();

    gtag('event', 'timing_complete', {
        event_category: 'Compile Sketch',
        event_label: 'Compile Time',
        non_interaction: true,
        value: timer.elapsed() / 1000,
    });

    this.timer.start();
    this.vm.init(chunk);
    this.running = true;

    await this.step();
};

DBN.prototype.step = async function () {
    try {
        await this.vm.run();
    } catch (err) {
        gtag('event', 'Runtime Error', { event_category: 'Execute Sketch' });
        console.log(err);
        // Trigger banner event with error object.
        let evt = new CustomEvent('error', {
            detail: {
                message: err.message,
                start: err.start,
                end: err.end,
            },
        });
        window.dispatchEvent(evt);
    }

    if (this.vm.state === VM_STATE_DONE) {
        this.stop(true);
    } else {
        const self = this;
        const frameRate = this.vm.redrawEnabled ? this.canvas.frameRate : 1;
        this.requestID = (requestAnimationFrame || ((cb) => setTimeout(cb, frameRate)))(self.step.bind(self));
    }
};

DBN.prototype.stop = function (ran_to_completion) {
    this.running = false;
    this.timer.stop();

    gtag('event', 'timing_complete', {
        event_category: 'Execute Sketch',
        event_label: 'Execution Time',
        ...(ran_to_completion ? { non_interaction: true } : {}),
        value: this.elapsed() / 1000,
    });

    this.timer.reset();
    if (cancelAnimationFrame) {
        cancelAnimationFrame(this.requestID);
    } else if (this.requestID) {
        clearTimeout(this.requestID);
    }

    const evt = new CustomEvent('vmstop', {});
    window.dispatchEvent(evt);
};

DBN.prototype.elapsed = function () {
    return this.timer.elapsed();
};

export default DBN;
