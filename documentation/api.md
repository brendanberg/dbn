# API Documentation

### Document Conventions

Command syntax is typeset in a fixed-width font. Bold text is used to indicate
parts of the syntax that should be entered as-is. Italicized text indicates
segments that should be replaced with a programmer-supplied value. Optional bits
of syntax are enclosed in square brackets. Places where programmer may supply
more than one value in a sequence are indicated with an ellipsis.


## Pen and Paper

### Paper

Sets every pixel on the canvas to a specified grayscale value. The value may
be an integer between 0 representing white (think 0% black), and 100 representing
black (as in 100% black).

<pre><strong>Paper</strong> <em>value</em></pre>

### Pen

Sets the pen color to a specified grayscale value. The value should be an integer
between 0 and 100.

<pre><strong>Pen</strong> <em>value</em></pre>


## Variables

### Set

Assigns a value to the named variable.

<pre><strong>Set</strong> <em>name</em> <em>value</em></pre>

Assigns a grayscale value to the specified x and y position on the canvas.
The value should be an integer between 0 and 100.

<pre><strong>Set [</strong><em>x</em> <em>y</em><strong>]</strong> <em>value</em></pre>

Assigns a value to a settable connector.

<pre><strong>Set &lt;</strong><em>connector</em> <em>arguments</em>...<strong>&gt;</strong> <em>value</em></pre>

## Drawing Commands

### Line

Draws a line between two points (x1, y1) and (x2, y2).

<pre><strong>Line</strong> <em>x1</em> <em>y1</em> <em>x2</em> <em>y2</em></pre>

The order the points are specified doesn't matter, so `Line 10 20 80 90` is the same
as `Line 80 90 10 20`.

### Field

Draws a box between two opposite corners defined by the points (x1, y1) and (x2, y2).
The pixels inside the area are filled with the specified grayscale value.

<pre><strong>Field</strong> <em>x1</em> <em>y1</em> <em>x2</em> <em>y2</em> <em>value</em></pre>

## Looping Commands

### Repeat

Repeats the statements in the loop body a fixed number of times. The statements
are executed once for each value of the iterator variable, which is initially
set to the start value and is incremented by one upon every iteration of the loop
until it equals the end value. (Unless the end value is less than the start value,
in which case the iterator is decremented by one until it equals the end value.)

<pre><strong>Repeat</strong> <em>iterator</em> <em>start</em> <em>end</em>
<strong>{</strong>
	// Commands
<strong>}</strong></pre>

### Forever

Repeats the statements in the loop body forever.

<pre><strong>Forever</strong>
<strong>{</strong>
	// Commands
<strong>}</strong></pre>


## Conditions

### Same?

Tests whether two values are the same. If they are, the statements within the
block are executed.

<pre><strong>Same?</strong> <em>value1</em> <em>value2</em>
<strong>{</strong>
	// Commands
<strong>}</strong></pre>

### NotSame?

Tests whether two values are not equal. If they are not equal, the statements
within the block are executed.

<pre><strong>NotSame?</strong> <em>value1</em> <em>value2</em>
<strong>{</strong>
	// Commands
<strong>}</strong></pre>

### Smaller?

Tests whether the first value is smaller than the second value. If it is,
the statements within the block are executed.

<pre><strong>Smaller?</strong> <em>value1</em> <em>value2</em>
<strong>{</strong>
	// Commands
<strong>}</strong></pre>

### NotSmaller?

Tests whether the first value is the same or larger than the second value.
If it is, the statements within the block are executed.

<pre><strong>NotSmaller?</strong> <em>value1</em> <em>value2</em>
<strong>{</strong>
	// Commands
<strong>}</strong></pre>


## Definitions

### Command

A command defines a named sequence of statements.

<pre><strong>Command</strong> <em>name</em> [<em>parameters</em>...]
<strong>{</strong>
	// Commands
<strong>}</strong></pre>

The `Command` statement should be followed by a name for the definition
and zero or more parameter names.

### Number

A number defines a named sequence of statements that produces a numeric result.
	
<pre><strong>Number</strong> <em>name</em> [<em>parameters</em>...]</pre>
	
The `Number` statement should be followed by a name for the definition and zero
or more parameter names.
	
```
Number Perimeter X Y
{
	Value (2 * X + 2 * Y)
}
```
	
The number `Perimeter` can be called with two arguments as shown below:

```
// Set the variable P to the perimiter of a rectangle
// with a width of 23 and a height of 48. 
Set P <Perimeter 23 48>
```

### Value

A value statement specifies the result of a `Number` definition.
The statement consists of the `Value` keyword followed by an expression.

<pre><strong>Value</strong> <em>expression</em></pre>

```
Number square X
{
    Value (X * X)
}
```


## Connectors

### Time

<pre><strong>&lt;Time</strong> <em>unit</em><strong>&gt;</strong></pre>


### Mouse

<pre><strong>&lt;Mouse</strong> <em>axis</em><strong>&gt;</strong></pre>

### Key

<pre><strong>&lt;Key</strong> <em>code</em><strong>&gt;</strong></pre>
