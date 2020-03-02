
const Timer = function() {
	this.startTime = 0;
	this.elapsedTime = 0;
};

Timer.prototype.start = function() {
	this.startTime = (new Date()).getTime();
};

Timer.prototype.stop = function() {
	if (this.startTime) {
		this.elapsedTime = this.elapsed();
		this.startTime = 0;
	}
};

Timer.prototype.reset = function() {
	this.startTime = 0;
	this.elapsedTime = 0;
};

Timer.prototype.elapsed = function() {
	const delta = this.startTime ? (new Date()).getTime() - this.startTime : 0;
	return this.elapsedTime + delta;
};

export default Timer;
