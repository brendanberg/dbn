# Language Guide

The DBN Grammar:

```
StatementList     ::= __ (CompoundStatement (Newline CompoundStatement)* )?
CompoundStatement ::= (Block | Statement) _? Comment?
                    | Comment
Block             ::= '{' StatementList '}'
                    | '{' __ '}'
Statement         ::= Name ValueList?

ValueList         ::= _? EnclosedValue ValueList?
                    | _ Scalar ValueList?

Value             ::= EnclosedValue | Scalar
EnclosedValue     ::= Parenthesized | Vector | Connector
Scalar            ::= Number | Name

Parenthesized     ::= '(' _? Expression _? ')'
Vector            ::= '[' _? ValueList _? ']'
Connector         ::= '<' _? Name (_ ValueList)? _? '>'

Expression        ::= Term (_? ['+' | '-'] _? Term)*
Term              ::= Value (_? ['*' | '/' | '%'] _? Value)*

Number            ::= '-'? [0-9]+
Name              ::= [A-Za-z] [A-Za-z0-9_]* '?'?

_                 ::= [ \t]+
__                ::= [ \t\n]*
Newline           ::= __ '\n' __
Comment           ::= '//' [^\n]*
```