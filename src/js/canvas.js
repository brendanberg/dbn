
const Canvas = function(paper) {
	this.frameRate = 1000/60;

	this.mouseX = 0;
	this.mouseY = 0;
	this.mouseDown = false;

	const self = this;
	const clamp = (value, min, max, scale) => {
		return Math.min(max, Math.max(min, Math.round(value / (scale || 1))));
	};

	const update = e => {
		const rect = e.target.getBoundingClientRect();
		self.mouseX = clamp(e.pageX - rect.left - 2, 0, self.width, 2);
		self.mouseY = clamp(self.height - (e.pageY - rect.top) - 1, 0, self.height, 2);
	};

	const click = e => {
		self.mouseDown = e.type === 'mousedown';
	};

	const saveImage = e => {
		if (e.altKey) {
			const image = paper.toDataURL('image/png');
			const link = document.createElement('a');
			link.setAttribute('download', 'frame.png');
			link.setAttribute('href', image.replace('image/png', 'image/octet-stream'));
			link.click();
		}
	};

	paper.addEventListener('mousemove', update, false);
	paper.addEventListener('mouseenter', update, false);
	paper.addEventListener('mousedown', click, false);
	paper.addEventListener('mouseup', click, false);
	paper.addEventListener('click', saveImage, false);

	this.width = paper.width;
	this.height = paper.height;
	this.paperCtx = paper.getContext('2d');
	// Transform, because DBN's origin is bottom left.
	this.paperCtx.translate(0, paper.height);
	this.paperCtx.scale(1, -1);

	// Set nearest-neighbor interpolation for zooming.
	this.paperCtx.webkitImageSmoothingEnabled = false;
	this.paperCtx.mozImageSmoothingEnabled = false;
	this.paperCtx.msImageSmoothingEnabled = false;
	this.paperCtx.imageSmoothingEnabled = false;
};

Canvas.prototype.redraw = function(image) {
	this.paperCtx.drawImage(image, 0, 0, image.width, image.height,
			0, 0, this.width, this.height);
};

export default Canvas;

