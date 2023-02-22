import Timer from './timer';
import * as Op from './opcodes';


const INTERPRET_RESULT_OK = 0x00,
	INTERPRET_RESULT_COMPILE_ERROR = 0x01,
	INTERPRET_RESULT_RUNTIME_ERROR = 0x02;


const VM = function(canvas, w, h) {
	const width = w || 101, height = h || 101;

	this.canvas = canvas;
	this.chunk = null;
	this.completed = false;

	this.ip = 0; // Instruction pointer; index into the code array of a chunk
	this.ep = 0; // Expression pointer; index of the top of the expression stack
	this.sp = 1; // Stack pointer; index of the next location in the call stack
	this.fp = 0; // Frame pointer; index of the previous frame location

	this.pen = new Uint32Array(2); // Pen color; stored as an RGBA packed integer
	// Fucking JavaScript numbers. The second integer is for temporary values
	// during computation. Otherwise we lose precision.
	this.exprStack = new Int32Array(256);
	this.callStack = new Int32Array(256);

	this.frame = document.createElement('canvas');
	this.frame.width = width;
	this.frame.height = height;
	const frameCtx = this.frame.getContext('2d');

	// Set nearest-neighbor interpolation for zooming.
	frameCtx.webkitImageSmoothingEnabled = false;
	frameCtx.mozImageSmoothingEnabled = false;
	frameCtx.msImageSmoothingEnabled = false;
	frameCtx.imageSmoothingEnabled = false;

	this.imageData = frameCtx.createImageData(width, height);
	this.pixelStarts = null;
	this.pixelEnds = null;
	this.locationStack = [];
	this.redrawEnabled = true;

	this.pauseTimer = new Timer();
	this.executionTimer = null;
	this.pauseInterval = 0;
};


VM.prototype.init = function(chunk) {
	this.chunk = chunk;
	this.completed = false;
	this.ip = 0;
	this.ep = 0;
	this.sp = 1;
	this.fp = 0;

	const frameCtx = this.frame.getContext('2d');

	// Set nearest-neighbor interpolation for zooming.
	frameCtx.webkitImageSmoothingEnabled = false;
	frameCtx.mozImageSmoothingEnabled = false;
	frameCtx.msImageSmoothingEnabled = false;
	frameCtx.imageSmoothingEnabled = false;
	this.pauseTimer.stop();
	this.pauseTimer.reset();
	this.pauseInterval = 0;
	this.executionTimer = new Timer();

	this.pixelStarts = new Int32Array(this.frame.width * this.frame.height);
	this.pixelEnds = new Int32Array(this.frame.width * this.frame.height);

	this.pen[0] = 0x000000FF;
	this.pen[1] = 0xFFFFFFFF;
	this.imageData = frameCtx.createImageData(this.frame.width, this.frame.height);
	this.fillCanvas();
	this.redraw();
};

VM.prototype.redraw = function() {
	this.frame.getContext('2d').putImageData(
			this.imageData, 0, 0, 0, 0, this.imageData.width, this.imageData.height);
	this.canvas.redraw(this.frame);
};

VM.prototype.explainPixel = function(x, y) {
	const index = (x + y * this.imageData.width);

	return {
		start: {offset: this.pixelStarts[index]},
		end: {offset: this.pixelEnds[index]}
	};
}

VM.prototype.readByte = function(chunk) {
	return chunk.code[this.ip++];
};

VM.prototype.readConstant = function(chunk) {
	return chunk.data[chunk.code[this.ip++]]; // this.readByte(chunk)];
};

VM.prototype.exprPush = function(value) {
	this.exprStack[this.ep] = value;
	this.ep++;
};

VM.prototype.exprPop = function() {
	this.ep--;
	return this.exprStack[this.ep];
};

VM.prototype.callPush = function(value) {
	this.callStack[this.sp] = value;
	this.sp++;
}

VM.prototype.callPop = function() {
	this.sp--;
	return this.callStack[this.sp];
};

VM.prototype.callElementAt = function(index) {
	if (index < 0 || index >= this.sp) {
		return null;
	}

	return this.callStack[index];
};

VM.prototype.callSetAt = function(index, value) {
	if (index < 0 || index >= this.sp) {
		return null;
	}

	this.callStack[index] = value;

	return true;
};

VM.prototype.setPenColor = function(color, idx) {
	this.pen[idx || 0] = color;
};

VM.prototype.setPenRGBA = function(r, g, b, a, idx) {
	idx = idx || 0;
	this.pen[idx] = 0;
	this.pen[idx] |= r << 24;
	this.pen[idx] |= g << 16;
	this.pen[idx] |= b << 8;
	//(r << 24 | g << 16 | b << 8 | a);
};

VM.prototype.readPixel = function(x, y) {
	if (x >= this.imageData.width || x < 0
			|| y >= this.imageData.height || y < 0) {
		return;
	}

	const index = (x + y * this.imageData.width) * 4;
	const r = this.imageData.data[index + 0];
	const g = this.imageData.data[index + 1];
	const b = this.imageData.data[index + 2];
	// TODO: Support alpha channel in pixel data
	// const a = this.imageData.data[index + 3];
	this.pen[1] = 0;
	this.pen[1] |= r << 24;
	this.pen[1] |= g << 16;
	this.pen[1] |= b << 8;
};

VM.prototype.grayscale = function(r, g, b) {
	// Return a gamma-corrected greyscale value for the r, g, b values passed in

	const rY = 0.212655;
	const gY = 0.715158;
	const bY = 0.072187;

	function inv_sRGB_gamma(c) {
		const v = c / 255.0;
		if (v <= 0.04045) {
			return v / 12.92;
		} else {
			return Math.pow((v + 0.055) / 1.055, 2.4);
		}
	}

	function sRGB_gamma(v) {
		if (v <= 0.0031308) {
			v *= 12.92;
		} else {
			v = 1.055 * Math.pow(v, 1.0 / 2.4) - 0.055;
		}

		return Math.round(v * 255);
	}

	function grayscale(r, g, b) {
		return sRGB_gamma(
				rY * inv_sRGB_gamma(r) +
				gY * inv_sRGB_gamma(g) +
				bY * inv_sRGB_gamma(b)
		);
	}

	if (r === g && g === b) {
		return r;
	} else {
		return grayscale(r, g, b);
	}
};

VM.prototype.writePixel = function(x, y) { // r, g, b) {
	if (x >= this.imageData.width || x < 0
			|| y >= this.imageData.height || y < 0) {
		return;
	}

	const index = (x + y * this.imageData.width);
	this.imageData.data[index * 4 + 0] = this.pen[1] >> 24 & 0xFF;
	this.imageData.data[index * 4 + 1] = this.pen[1] >> 16 & 0xFF;
	this.imageData.data[index * 4 + 2] = this.pen[1] >> 8 & 0xFF;
	this.imageData.data[index * 4 + 3] = 255;

	const span = this.locationStack[this.locationStack.length - 1];
	if (span) {
		this.pixelStarts[index] = span[0];
		this.pixelEnds[index] = span[1];
	}
};

VM.prototype.fillCanvas = function() { //r, g, b) {
	const width = this.imageData.width, height = this.imageData.height;
	let start;
	let end;

	if (this.chunk) {
		const span = this.locationStack[this.locationStack.length - 1];
		if (span) {
			[start, end] = span;
		}
	} else {
		start = end = 0;
	}


	for (let i = 0, len=(width*height); i < len; i++) {
		this.imageData.data[i * 4 + 0] = this.pen[1] >> 24 & 0xFF;
		this.imageData.data[i * 4 + 1] = this.pen[1] >> 16 & 0xFF;
		this.imageData.data[i * 4 + 2] = this.pen[1] >> 8 & 0xFF;
		this.imageData.data[i * 4 + 3] = 255;

		this.pixelStarts[i] = start;
		this.pixelEnds[i] = end;
	}
};


VM.prototype.run = function() {
	// Continually fetch the next instruction in the chunk's code array and
	// execute the loop body if the instruction is not Op.HALT

	// TODO: replace this with an isRunning state flag
	if (this.pauseTimer.startTime) {
		if (this.pauseTimer.elapsed() >= this.pauseInterval) {
			this.pauseTimer.stop();
			this.pauseTimer.reset();
			this.pauseInterval = 0;
		} else {
			return;
		}
	}
	const chunk = this.chunk;
	const timer = new Timer();
	timer.start();
	this.executionTimer.start();

	let cycles = 0;
	let instr = Op.HALT;

	while(instr = chunk.code[this.ip++]) {
		cycles++;

		switch(instr) {
			case Op.CONSTANT: {
				// this.exprPush(this.readConstant(chunk));
				// The first byte after the opcode will always be a
				let idx = (chunk.code[this.ip++] & 0x7F);

				for (; (chunk.code[this.ip - 1] & 0x80) !== 0; this.ip++) {
					idx = idx << 7;
					idx |= (chunk.code[this.ip] & 0x7F);
				}

				this.exprStack[this.ep++] = chunk.data[idx];
				// this.exprStack[this.ep++] = chunk.data[chunk.code[this.ip++]];
				break;
			}
			case Op.GET_ARGUMENT: {
				// const offset = this.readByte(chunk);
				// const argValue = this.callElementAt(this.fp - offset - 2);
				// this.exprPush(argValue);
				const index = this.fp - chunk.code[this.ip++] - 2;

				if (index < 0 || index >= this.sp) {
					const lastLocation = this.locationStack.pop();
					throw {
						message: 'runtime error',
						start: lastLocation[0],
						end: lastLocation[1]
					};
					//return INTERPRET_RESULT_RUNTIME_ERROR;
				}

				this.exprStack[this.ep++] = this.callStack[index];
				break;
			}
			case Op.SET_ARGUMENT: {
				const index = this.fp - chunk.code[this.ip++] - 2;

				if (index < 0 || index >= this.sp) {
					const lastLocation = this.locationStack.pop();
					throw {
						message: 'runtime error',
						start: lastLocation[0],
						end: lastLocation[1]
					};
					//return INTERPRET_RESULT_RUNTIME_ERROR;
				}

				this.callStack[index] = this.exprStack[--this.ep];
				break;
			}
			case Op.GET_LOCAL: {
				const index = this.fp + chunk.code[this.ip++] + 1;

				if (index < 0 || index >= this.sp) {
					const lastLocation = this.locationStack.pop();
					throw {
						message: 'runtime error',
						start: lastLocation[0],
						end: lastLocation[1]
					};
					//return INTERPRET_RESULT_RUNTIME_ERROR;
				}

				this.exprStack[this.ep++] = this.callStack[index];
				break;
			}
			case Op.SET_LOCAL: {
				const offset = chunk.code[this.ip++];
				const index = this.fp + offset + 1;

				if (index < 0 || index >= this.sp) {
					const lastLocation = this.locationStack.pop();
					throw {
						message: 'runtime error',
						start: lastLocation[0],
						end: lastLocation[1]
					};
					//return INTERPRET_RESULT_RUNTIME_ERROR;
				}

				this.callStack[index] = this.exprStack[--this.ep];
				break;
			}
			case Op.ADD: {
				/*
				let b = this.exprPop();
				let a = this.exprPop();
				this.exprPush(a + b);
				*/
				const b = this.exprStack[--this.ep];
				const a = this.exprStack[--this.ep];
				this.exprStack[this.ep++] = a + b;
				break;
			}
			case Op.SUBTRACT: {
				/*
				let b = this.exprPop();
				let a = this.exprPop();
				this.exprPush(a - b);
				*/
				const b = this.exprStack[--this.ep];
				const a = this.exprStack[--this.ep];
				this.exprStack[this.ep++] = a - b;
				break;
			}
			case Op.MULTIPLY: {
				/*
				let b = this.exprPop();
				let a = this.exprPop();
				this.exprPush(a * b);
				*/
				const b = this.exprStack[--this.ep];
				const a = this.exprStack[--this.ep];
				this.exprStack[this.ep++] = a * b;
				break;
			}
			case Op.DIVIDE: {
				/*
				let b = this.exprPop();
				let a = this.exprPop();
				this.exprPush(a / b);
				*/
				const b = this.exprStack[--this.ep];
				const a = this.exprStack[--this.ep];
				this.exprStack[this.ep++] = Math.floor(a / b);
				break;
			}
			case Op.REMAINDER: {
				/*
				let b = this.exprPop();
				let a = this.exprPop();
				this.exprPush(a % b);
				*/
				const b = this.exprStack[--this.ep];
				const a = this.exprStack[--this.ep];
				this.exprStack[this.ep++] = a % b;
				break;
			}
			case Op.NEGATE: {
				/*
				let a = this.exprPop();
				this.exprPush(-a);
				*/
				this.exprStack[this.ep - 1] = -(this.exprStack[this.ep - 1]);
				break;
			}
			case Op.CLAMP: {
				/*
				let max = this.exprPop();
				let min = this.exprPop();
				let val = this.exprPop();
				this.exprPush(Math.max(min, Math.min(max, val)));
				*/
				const max = this.exprStack[--this.ep];
				const min = this.exprStack[--this.ep];
				const val = this.exprStack[--this.ep];
				this.exprStack[this.ep++] = Math.max(min, Math.min(max, val));
				break;
			}
			case Op.DUPLICATE: {
				this.exprStack[this.ep] = this.exprStack[this.ep - 1];
				this.ep++;
				break;
			}
			case Op.POP: {
				this.ep--;
				break;
			}
			case Op.SET_PEN_COLOR: {
				// Pop an integer representation of a color from the expression
				// stack with the layout RRRRRRRR GGGGGGGG BBBBBBBB AAAAAAAA
				this.pen[0] = this.exprStack[--this.ep];
				break;
			}
			case Op.READ_PIXEL: {
				const y = this.exprStack[--this.ep];
				const x = this.exprStack[--this.ep];
				this.readPixel(x, y);
				this.exprStack[this.ep++] = this.pen[1];
				break;
			}
			case Op.WRITE_PIXEL: {
				this.pen[1] = this.exprStack[--this.ep];
				let y = this.exprStack[--this.ep];
				let x = this.exprStack[--this.ep];
				this.writePixel(x, y);
				break;
			}
			case Op.FILL_PIXEL: {
				let y = this.exprStack[--this.ep];
				let x = this.exprStack[--this.ep];
				this.pen[1] = this.pen[0];
				this.writePixel(x, y);
				break;
			}
			case Op.FILL_CANVAS: {
				this.pen[1] = this.exprStack[--this.ep];
				this.fillCanvas();
				break;
			}
			case Op.PACK_GRAY: {
				const color = Math.min(this.exprStack[--this.ep], 0xFF);
				this.exprStack[this.ep++] = 0;
				this.exprStack[this.ep - 1] |= color << 24;
				this.exprStack[this.ep - 1] |= color << 16;
				this.exprStack[this.ep - 1] |= color << 8;
				break;
			}
			case Op.PACK_RGB: {
				const b = this.exprStack[--this.ep] & 0xFF;
				const g = this.exprStack[--this.ep] & 0xFF;
				const r = this.exprStack[--this.ep] & 0xFF;
				this.exprStack[this.ep++] = 0;
				this.exprStack[this.ep - 1] |= r << 24;
				this.exprStack[this.ep - 1] |= g << 16;
				this.exprStack[this.ep - 1] |= b << 8;
				break;
			}
			case Op.PACK_RGBA: {
				const a = this.exprStack[--this.ep] & 0xFF;
				const b = this.exprStack[--this.ep] & 0xFF;
				const g = this.exprStack[--this.ep] & 0xFF;
				const r = this.exprStack[--this.ep] & 0xFF;
				this.exprStack[this.ep++] = 0;
				this.exprStack[this.ep - 1] |= r << 24;
				this.exprStack[this.ep - 1] |= g << 16;
				this.exprStack[this.ep - 1] |= b << 8;
				this.exprStack[this.ep - 1] |= a;
				break;
			}
			case Op.UNPACK_GRAY: {
				const r = this.exprStack[this.ep - 1] >> 24 & 0xFF;
				const g = this.exprStack[this.ep - 1] >> 16 & 0xFF;
				const b = this.exprStack[this.ep - 1] >> 8 & 0xFF;
				this.exprStack[this.ep - 1] = this.grayscale(r, g, b);
				break;
			}
			case Op.UNPACK_RGB: {
				const r = this.exprStack[this.ep - 1] >> 24 & 0xFF;
				const g = this.exprStack[this.ep - 1] >> 16 & 0xFF;
				const b = this.exprStack[this.ep - 1] >> 8 & 0xFF;
				this.exprStack[this.ep - 1] = r;
				this.exprStack[this.ep++] = g;
				this.exprStack[this.ep++] = b;
				break;
			}
			case Op.JUMP: {
				const high = chunk.code[this.ip++]; // this.readByte(chunk);
				const low = chunk.code[this.ip++]; // this.readByte(chunk);
				this.ip = (high << 8) | low;
				break;
			}
			case Op.JUMP_IF_NEGATIVE: {
				// JmpNegative h l;
				const val = this.exprStack[--this.ep]; //this.exprPop();
				const high = chunk.code[this.ip++]; // this.readByte(chunk);
				const low = chunk.code[this.ip++]; // this.readByte(chunk);

				if (val < 0) {
					this.ip = (high << 8) | low;
				}

				break;
			}
			case Op.JUMP_IF_NONNEGATIVE: {
				const val = this.exprStack[--this.ep];
				const high = chunk.code[this.ip++];
				const low = chunk.code[this.ip++];

				if (val >= 0) {
					this.ip = (high << 8) | low;
				}

				break;
			}
			case Op.JUMP_IF_ZERO: {
				const val = this.exprStack[--this.ep];
				const high = chunk.code[this.ip++];
				const low = chunk.code[this.ip++];

				if (val === 0) {
					this.ip = (high << 8) | low;
				}

				break;
			}
			case Op.JUMP_IF_NONZERO: {
				const val = this.exprStack[--this.ep];
				const high = chunk.code[this.ip++];
				const low = chunk.code[this.ip++];

				if (val !== 0) {
					this.ip = (high << 8) | low;
				}

				break;
			}
			case Op.PAUSE: {
				// The PAUSE opcode breaks us out of the execution loop for
				// a specified number of hundredths of seconds. The next
				// animation frame will call run() again and we'll test whether
				// the timer has reached the pauseInterval value. If not, we
				// return early, otherwise we reset the timer and continue
				// program execution.
				const interval = this.exprStack[--this.ep];
				this.pauseInterval = interval * 10;
				this.pauseTimer.start();
				this.executionTimer.stop();
				return;
			}
			case Op.STACK_ALLOC: {
				// This allocates space on the stack for arguments, which are
				// copied over in the compiled function's preamble
				const arity = chunk.code[this.ip++];

				for (let i = 0; i < arity; i++) {
					this.callStack[this.sp++] = 0;
				}

				break;
			}
			case Op.STACK_FREE: {
				const arity = chunk.code[this.ip++];
				
				for (let i = 0; i < arity; i++) {
					this.callStack[--this.sp];
				}

				break;
			}
			case Op.CALL: {
				// Call h l;

				const high = chunk.code[this.ip++];
				const low = chunk.code[this.ip++];

				this.callStack[this.sp++] = this.ip;
				const prev = this.fp;
				this.fp = this.sp;
				this.callStack[this.sp++] = prev;
				this.ip = (high << 8) | low;
				break;
			}
			case Op.INVOKE: {
				const arity = chunk.code[this.ip++];
				const index = chunk.code[this.ip++];

				if (index < 0 || index >= chunk.exports.length) {
					const lastLocation = this.locationStack.pop();
					throw {
						message: 'host function index out of bounds',
						start: lastLocation[0],
						end: lastLocation[1]
					};
					//throw 'host function index out of bounds';
				}

				const args = [];

				for (let i = 0, len = chunk.exports[index].length; i < len; i++) {
					args.push(this.callStack[this.fp - i - 2]);
				}

				this.exprStack[this.ep++] = chunk.exports[index].apply(null, args);
				break;
			}
			case Op.RETURN: {
				// Return;

				// If you don't want the compiled function to have to clean up
				// the locals it allocated in its preamble, you can set the SP
				// to the current FP value before popping the previously saved
				// pointer values:
				//
				// this.sp = this.fp;
				// this.fp = this.callStack[this.sp];
				this.fp = this.callStack[--this.sp];
				this.ip = this.callStack[--this.sp];
				break;
			}
			case Op.LOCATION_PUSH: {
				const start = chunk.data[chunk.code[this.ip++]];
				const end = chunk.data[chunk.code[this.ip++]];
				this.locationStack.push([start, end]);
				break;
			}
			case Op.LOCATION_POP: {
				this.locationStack.pop();
				break;
			}
			case Op.REDRAW: {
				if (this.redrawEnabled) {
					this.redraw();
					this.executionTimer.stop();
					return;
				}
				break;
			}
			case Op.REDRAW_OFF: {
				this.redrawEnabled = false;
				break;
			}
			case Op.REDRAW_FORCE: {
				this.redraw();
				this.executionTimer.stop();
				return;
			}
			default: {
				const lastLocation = this.locationStack.pop();
				throw {
					message: 'unrecognized opcode ' + instr,
					start: lastLocation[0],
					end: lastLocation[1]
				};
				//console.error('unrecognized opcode', instr);
				//return INTERPRET_RESULT_RUNTIME_ERROR;
			}
		}

		// Be a good citizen and don't hog the CPU. After every 1000 executed
		// opcodes, check the time. If we've been running more than 100
		// milliseconds, stop running so other events can fire.
		//
		// We use requestAnimationFrame to restart execution.
		if (cycles > 1000) {
			if (timer.elapsed() > 50) {
				this.executionTimer.stop();
				return;
			}
			cycles = 0;
		}
	}

	this.executionTimer.stop();
	this.completed = true;
	this.redraw();

	if (this.ep !== 0) {
		console.error('the program left values on the stack');
		//console.log(this.expressionStack.slice(0, this.ep));
		return INTERPRET_RESULT_RUNTIME_ERROR;
	} else {
		return INTERPRET_RESULT_OK;
	}
};

export default VM;
