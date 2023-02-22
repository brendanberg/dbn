// Parsing Expression Grammar for Brendan Berg's reconstruction of John Maeda's
// Design by Numbers programming language and environment.

{
	const AST = require('../js/ast').default;
}

start
	= ls:statementList { return new AST.Program(ls, location()); }

statementList
	= __ first:compoundStatement rest:trailingStatements* __ {
			return [first].concat(rest);
		}
	/ __ { return []; }

trailingStatements
	= linespace:_S s:compoundStatement {
			s.preceding = linespace.join('').split('\n').length - 1;
			return s;
		}

compoundStatement
	= b:(block / statement) c:(_? c:comment { return c; })? {
		b.comment = c;
		return b;
	}
	/ c:comment { return c; }

block
	= "{" _S "}" { return new AST.Block([], location()); }
	/ "{" ls:statementList "}" { return new AST.Block(ls, location()); }

statement
	= n:command ls:(v:valueList { return v; })? {
			return new AST.Statement(n, ls || [], location());
		}

valueList
	= _ first:atomicValue rest:(valueList)? {
			return [first].concat(rest || []);
		}
	/ _? first:compoundValue rest:(valueList)? {
			return [first].concat(rest || []);
		}

value
	= compoundValue / atomicValue

compoundValue
	= parenthesized / vector / generator

atomicValue
	= i:number { return new AST.Integer(i, location()); }
	/ n:variable { return new AST.Identifier(n, location()); }

parenthesized
	= "(" _? e:expression _? ")" { e.parenthesized = true; return e; }

vector
	= "[" _? v:value vs:(valueList)? _? "]" {
			return new AST.Vector([v].concat(vs || []), location())
		}

generator 
	= "<" _? n:name vs:(valueList)? _? ">" {
			return new AST.Generator(n, vs || [], location());
		}

number "number"
	= s:(x:"-"? { return [x || '']; }) d:[0-9]+ { return parseInt(s.concat(d).join(''), 10); }

variable "variable"
	= name

command "command"
	= n:name { return new AST.Identifier(n, location()); }

name
	= first:[A-Za-z] rest:[A-Za-z0-9_?]* { return first + rest.join(''); }

expression
	= first:term rest:(_? op:addOper _? rhs:term {
		return new AST.Operator(op, null, rhs, location());
	})* {
		return rest.reduce((ast, expr) => { expr.lhs = ast; return expr; }, first);
	}

term
	= first:value rest:(_? op:mulOper _? rhs:value {
		return new AST.Operator(op, null, rhs, location());
	})* {
		return rest.reduce((ast, expr) => { expr.lhs = ast; return expr; }, first);
	}

mulOper "symbol"
	= "*" { return '*'; }
	/ "/" { return '/'; }
	/ "%" { return '%'; }

addOper "symbol"
	= "+" { return '+'; }
	/ "-" { return '-'; }

comment ""
	= "//" text:[^\n]* { return new AST.Comment(text.join(''), location()); }

_ "whitespace"
	= [ \t]+

_S "newline" 
	= _? '\n' __

__ "whitespace"
	= [ \t\n]*
