// Draw by Numeral
// (c) Brendan Berg 2019-2026

import VM from './vm';
import AST from './ast';
import Timer from './timer';
import Canvas from './canvas';
import assemble from './assemble';
import parser from '../grammar/dbn.pegjs';
import axios from 'axios';
import { VM_STATE_WAITING, VM_STATE_RUNNING, VM_STATE_PAUSED, VM_STATE_DONE, VM_STATE_ERROR } from './vm';
import {
    removeComments,
    resolveIdentifiers,
    commandTransform,
    loadIncludesRecursive,
    replaceLocations,
} from './transforms';

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

DBN.prototype.beautify = async function (source, callback) {
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

    ast = await ast.applyTransformations([resolveIdentifiers, updateIdentifiers]);

    if (callback && typeof callback === 'function') {
        this.callback = callback;
    }

    return ast.indent(0);
};

DBN.prototype.parse = function (source) {
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

    return ast;
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

    let ast = this.parse(source);

    const includes = {};

    ast = await ast.applyTransformations([
        loadIncludesRecursive(this.parse.bind(this), includes),
        removeComments,
        commandTransform,
        resolveIdentifiers,
    ]);

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
            // 1 = hour, 2 = minute, 3 = second, and 4 = centisecond.
            case 1:
                return now.getHours();
            case 2:
                return now.getMinutes();
            case 3:
                return now.getSeconds();
            case 4:
                return ~~(now.getMilliseconds() / 10);
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
