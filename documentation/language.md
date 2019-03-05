# Language Guide

This document describes the structure of the DBN language.
If you would rather read the [EBNF description of the language][ebnf],
it is included at the end of this document. 

[ebnf]: https://github.com/brendanberg/dbn/blob/master/documentation/language.md#dbn-grammar

### Comments and Whitespace

The DBN grammar ignores whitespace except where it is syntactically necessary to delineate individual tokens.
Comments begin with two slashes (`//`) and continue to the end of the line.
Like whitespace, they are also ignored by the DBN compiler.

```
// This is a comment.
```

Newline characters are required between statements,
and between a statement and a block.

### Statements

A __Statement__ consists of a name followed by zero or more values.

```
Line 10 20 90 20
```


### Blocks

A __Block__ is a sequence of statements enclosed in braces (`{` and `}`).
The start and end braces must be the only non-whitespace and non-comment
symbols on their lines.

```
{
    Set A 20
    Line 10 A 90 A
}
```

### Values

A __Value__ is either an atomic value like a number or a name,
or a compound value that is enclosed in either parentheses (`(` and `)`),
square brackets (`[` and `]`), or angle brackets (`<` and `>`).

Spaces are required to separate atomic values.
Spaces are optional, but fanatically encouraged, around compound values.

```
Set A 30                // The name `A` and the number `30` are both atomic values
Paper (A * 2)           // The expression `(A * 2)` is a compound value
Set [20 A] 100          // The vector `[20 A]` is a compound value
Set Q <Random 100>      // The connector `<Random 100>` is a compound value
```

### Expressions

An __Expression__ is a sequence of mathematical symbols enclosed in parentheses.
Inside the parentheses, an expression consists of a sequence of values
separated by arithmetic operators.

Valid arithmetic operators are `+` (addition), `-` (subtraction), `*`
(multiplication), `/` (division), and `%` (remainder).

DBN follows standard mathematical order of operations (multiplication,
division, and remainders will be calculated before addition and subtraction).
To force addition or subtraction to be done first, the operator and its terms
should be surrounded by parentheses.

```
Set A (6 + 8 * 2)       // The variable `A` gets the value 22.
Set B ((6 + 8) * 2)     // The variable `B` gets the value 28.
```

### Vectors

A __Vector__ is a sequence of values enclosed in square brackets.
In DBN, vectors represent a set of pixel coordinates on the canvas.

They may be used anywhere a value is expected,
in which case they evaluate to the pixel grayscale level at the specified coordinates.

Additionally, when used as the receiver in a `Set` statement,
they use the subsequent value to set the grayscale level for the pixel at the specified location.

### Connectors

A __Connector__ consists of a name followed by zero or more values,
all enclosed in angle brackets.
The connector name should match a built-in or user-defined number definition.
The number of values should match the number of parameters expected by the number definition.

Connectors may be used anywhere a value is expected.
When a connector is used as a value in a statement,
the number definition with the same name is invoked with the connector's values as arguments.

The example below shows a conditional block using the connector `<Mouse 1>`
to test whether the mouse's X position is less than 50.

```
Smaller? <Mouse 1> 50
{
    Field 0 0 50 100 30
}
```

### Numbers

A __Number__ is a sequence of digits 0 through 9,
optionally preceded by a sign symbol (`+` or `-`).

Numbers in DBN are integers in the range -2,147,483,648 to 2,147,483,647.

### Names

A __Name__ is a sequence of one or more letters and numbers
that can be used to refer to values or procedures.
DBN names must start with an upper- or lowercase letter A through Z, or an underscore (`_`),
and can be followed by any number of letters, numerals 0 through 9, underscores, and question marks (`?`).

Names in DBN are not case-sensitive, so `MyName`, `MYNAME`, and `myname` are all synonyms.

## DBN Grammar

The EBNF grammar for the DBN parser is reproduced below.
This is a translation from the PEG parser implementation,
but is an accurate description of the language's grammar.

```
StatementList     ::= __ (CompoundStatement (Newline CompoundStatement)* )?
CompoundStatement ::= (Block | Statement) _? Comment?
                    | Comment
Block             ::= '{' _? Comment? Newline StatementList Newline '}'
                    | '{' _? Comment? Newline '}'
Statement         ::= Name ValueList?

ValueList         ::= _? CompoundValue ValueList?
                    | _ AtomicValue ValueList?

Value             ::= CompoundValue | AtomicValue
CompoundValue     ::= Vector | Connector | Expression
AtomicValue       ::= Number | Name

Vector            ::= '[' ValueList _? ']'
Connector         ::= '<' _? Name ValueList? _? '>'

Expression        ::= '(' _? Term (_? ['+' | '-'] _? Term)* _? ')'
Term              ::= Value (_? ['*' | '/' | '%'] _? Value)*

Number            ::= ('-' | '+')? [0-9]+
Name              ::= [A-Za-z?] [A-Za-z0-9_?]*

_                 ::= [ \t]+
__                ::= [ \t\n]*
Newline           ::= __ '\n' __
Comment           ::= '//' [^\n]*
```
