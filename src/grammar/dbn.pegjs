// Parsing Expression Grammar for Brendan Berg's reconstruction of John Maeda's
// Design by Numbers programming language and environment.

{
	const AST = require('../js/ast').default;
}

start
	= __ ls:statementList? __ { return new AST.Program(ls || [], location()); }

statementList
	= first:compoundStatement rest:($ __ s:compoundStatement { return s; })* {
			return first.concat(rest.reduce((f, r) => f.concat(r), []));
		}

compoundStatement
	= b:(block / statement) c:(_? c:comment { return c; })? {
		return [b].concat(c || []);
	}
	/ c:comment { return [c]; }

block
	= "{" __ "}" { return new AST.Block([], location()); }
	/ "{" __ ls:statementList __ "}" { return new AST.Block(ls, location()); }

statement
	= n:command ls:(_ v:valueList { return v; })? {
			return new AST.Statement(n, ls || [], location());
		}

valueList
	= first:bareValue rest:(_ vs:valueList { return vs; })? {
			return [first].concat(rest || []);
		}
	/ first:enclosedValue rest:(_? vs: valueList { return vs; })? {
			return [first].concat(rest || []);
		}

value
	= enclosedValue / bareValue

enclosedValue
	= parenthesized / vector / generator

bareValue
	= scalar

parenthesized
	= "(" _? e:addExpression _? ")" { return e; }

vector
	= "[" _? v:valueList _? "]" { return new AST.Vector(v, location()) }

generator 
	= "<" _? n:name vs:(_ x:valueList { return x; })? _? ">" {
			return new AST.Generator(n, vs || [], location());
		}

scalar
	= i:number { return new AST.Integer(i, location()); }
	/ n:variable { return new AST.Identifier(n, location()); }

number "number"
	= s:(x:"-"? { return [x || '']; }) d:[0-9]+ { return parseInt(s.concat(d).join(''), 10); }

variable "variable"
	= name

command "command"
	= n:name { return new AST.Identifier(n, location()); }

name
	= first:[A-Za-z] rest:[A-Za-z0-9_?]* { return first + rest.join(''); }

addExpression
	= first:mulExpression rest:(_? op:addOper _? rhs:mulExpression {
		return new AST.Operator(op, null, rhs, location());
	})* {
		return rest.reduce((ast, expr) => { expr.lhs = ast; return expr; }, first);
	}

mulExpression
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
	= "//" _? text:[^\n]* { return new AST.Comment(text.join(''), location()); }

_ ""
	= [ \t]+

$
	= newline

newline "new line"
	= "\n"+

__ ""
	= [ \t\n]*
