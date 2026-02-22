// Parsing Expression Grammar for Brendan Berg's reconstruction of John Maeda's
// Design by Numbers programming language and environment.

{
	const AST = require('../js/ast').default;

	function isValidUrl(string) {
		let url;
		try {
			url = new URL(string);
		} catch (_) {
			return false;
		}

		return url.protocol === "https:";
	}
}

start
	= ls:statementList { return new AST.Program(ls, location()); }

statementList
	= __ first:compoundStatement rest:trailingStatements* __ {
			return [first].concat(rest);
		}
	/ __ { return []; }

trailingStatements
	= linespace:$_S s:compoundStatement {
			s.preceding = linespace.split('\n').length - 1;
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

// Load is a special case because it takes a filename, saved sketch path, or URL.

statement
	= [Ll] [Oo] [Aa] [Dd] _ r:resource { return new AST.Load(r, location()); }
	/ n:command ls:(v:valueList { return v; })? {
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
	= i:$number { return new AST.Integer(parseInt(i, 10), location()); }
	/ n:variable

parenthesized
	= "(" _? e:expression _? ")" { e.parenthesized = true; return e; }

vector
	= "[" _? v:value vs:(valueList)? _? "]" {
			return new AST.Vector([v].concat(vs || []), location())
		}

generator 
	= "<" _? n:$name vs:(valueList)? _? ">" {
			return new AST.Generator(n, vs || [], location());
		}

number "number"
	= [\-]? [0-9]+

variable "variable"
	= n:$name { return new AST.Identifier(n, location()); }

command "command"
	= n:$name { return new AST.Identifier(n, location()); }

name
	= [A-Za-z] [A-Za-z0-9_?]*

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
	= "*" / "/" / "%"

addOper "symbol"
	= "+" / "-"

resource ""
	= upload / builtin / url

url "URL"
	= "https://" h:$host p:$path  {
		const urlString = 'https://' + h + p;

		if (isValidUrl(urlString)) {
			return urlString;
		}
	}

upload "user upload"
	= "@" u:$[A-Za-z0-9_-]+ "/" s:$[A-Za-z0-9_-]+ ".dbn"  { return '@' + u + '/' + s + '.dbn';}

builtin "builtin"
	= s:$[A-Za-z0-9_-]+ ".dbn"  { return s + '.dbn';}

host "domain"
	= a:ipv4 p:port?
	/ [A-Za-z0-9\-] [A-Za-z0-9\-]+ ("." [A-Za-z0-9\-] [A-Za-z0-9\-]+)+ p:port?

ipv4 "address"
	= quad "." quad "." quad "." quad

quad
	= "25" [0-5]
	/ "2" [0-4] [0-9]
	/ [0-1] [0-9] [0-9]
	/ [0-9] [0-9]
	/ [0-9]

port "port"
	= ":" [0-9] [0-9] [0-9] [0-9] [0-9]
	/ ":" [0-9] [0-9] [0-9] [0-9]
	/ ":" [0-9] [0-9] [0-9]
	/ ":" [0-9] [0-9]
	/ ":" [0-9]

path ""
	= [A-Za-z0-9\-._~!$&'()*+,;=:@%/?]+

comment ""
	= "//" text:$[^\n]* { return new AST.Comment(text, location()); }

_ "whitespace"
	= [ \t]+

_S "newline" 
	= _? '\n' __

__ "whitespace"
	= [ \t\n]*
