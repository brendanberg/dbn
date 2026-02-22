import AST from './ast';
import axios from 'axios';

// Transform STATEMENT, BLOCK sequences into COMMAND[ BLOCK ] nodes
export const commandTransform = async (node) => {
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

                    newStatements.push(await builder(stmnt, body).transform(commandTransform));
                } else {
                    newStatements.push(stmnt);
                }
            } else {
                newStatements.push(stmnt);
            }
        }

        node.statements = newStatements;
        return [node, true];
    }

    return [node, true];
};

export const resolveIdentifiers = async (node, outerMeta) => {
    // console.log('Resolving identifiers in node of type ' + node.meta.type);
    // console.log(node);
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

        commands = await Promise.all(
            commands.map(async (c) => {
                c = await c.transform(resolveIdentifiers, node.meta);
                Array.prototype.push.apply(node.meta.commands[c.name.canonical].unbound, c.meta.unbound);
                return c;
            })
        );

        numbers = await Promise.all(
            numbers.map(async (n) => {
                n = await n.transform(resolveIdentifiers, node.meta);
                Array.prototype.push.apply(node.meta.numbers[n.name.canonical].unbound, n.meta.unbound);
                return n;
            })
        );

        node.statements = await Promise.all(
            node.statements
                .filter((s) => s.meta.type !== 'command' && s.meta.type !== 'number')
                .map((s) => s.transform(resolveIdentifiers, node.meta))
        );

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

            node.start = await node.start.transform(resolveIdentifiers, outerMeta);
            node.stop = await node.stop.transform(resolveIdentifiers, outerMeta);
        }
        node.statements = await Promise.all(node.statements.map((s) => s.transform(resolveIdentifiers, outerMeta)));
        return [node, false];
    } else if (node.meta.type === 'condition') {
        // TODO: Can this simply be handled by the default recursive case?
        node.predicate = await node.predicate.transform(resolveIdentifiers, outerMeta);
        node.statements = await Promise.all(node.statements.map((s) => s.transform(resolveIdentifiers, outerMeta)));
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
                node.args[0] = await node.args[0].transform(resolveIdentifiers, outerMeta);
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
                .concat(await Promise.all(node.args.slice(1).map((n) => n.transform(resolveIdentifiers, outerMeta))));

            return [node, false];
        } else {
            if (!outerMeta.commands.hasOwnProperty(node.canonical)) {
                console.log(node);
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

            node.args = await Promise.all(node.args.map((n) => n.transform(resolveIdentifiers, outerMeta)));
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

        node.args = await Promise.all(node.args.map((n) => n.transform(resolveIdentifiers, outerMeta)));
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

// Remove comment nodes from the AST
export const removeComments = (node) => {
    if (node.hasOwnProperty('statements')) {
        node.statements = node.statements.filter((s) => s.meta.type !== 'comment');
    }

    return [node, true];
};

// Recursively load included libraries and apply transformations to them
export const loadIncludesRecursive = (parse, includes) => async (node) => {
    if (node.meta.type === 'program') {
        const newStatements = [];

        for (let stmt of node.statements) {
            if (stmt.meta.type === 'load') {
                if (includes.hasOwnProperty(stmt.location)) {
                    throw {
                        message: 'duplicate import of "' + stmt.location + '"',
                        start: stmt.meta.start,
                        end: stmt.meta.end,
                    };
                } else {
                    includes[stmt.location] = true;
                }

                let location;
                if (stmt.location.startsWith('@')) {
                    location = 'https://dbn.artistcontent.com/' + stmt.location;
                } else if (!stmt.location.startsWith('https://')) {
                    location = '/builtins/' + stmt.location;
                }

                let subtree;

                try {
                    const response = await axios.get(location);
                    subtree = parse(response.data);
                } catch (err) {
                    console.log(err);
                    throw {
                        message: 'failed to load "' + stmt.location + '"',
                        start: stmt.meta.start,
                        end: stmt.meta.end,
                    };
                }

                const start = stmt.meta.start;
                start.offset += 5;
                let xform;

                try {
                    xform = await subtree.applyTransformations([
                        loadIncludesRecursive(parse, includes),
                        replaceLocations(start, stmt.meta.end),
                    ]);
                } catch (err) {
                    throw {
                        message: err.message,
                        start: stmt.meta.start,
                        end: stmt.meta.end,
                    };
                }

                newStatements.push(...xform.statements);
            } else {
                newStatements.push(stmt);
            }
        }

        node.statements = newStatements;
    }
    return [node, true];
};

// Replace the start and end positions of a node with new values
// (used when importing code from a library, since the original start and end
//  positions will be meaningless in the context of the importing program.)
export const replaceLocations = (start, end) => async (node) => {
    node.meta.start = start;
    node.meta.end = end;
    return [node, true];
};
