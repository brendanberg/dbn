/* Draw By Numeral
 * by Brendan Berg
 * 
 * main.js initializes the PixelPusher VM and connects window UI elements to
 * their desired actions. That's it :)
 */
import axios from 'axios';
import DBN from './dbn';

const SHOULD_SHOW_MODAL = 'environment:modal:showAtStartup';
const SKETCH_VALUE_KEY = 'environment:sketch.value';
const SKETCH_DEFAULT_PLACEHOLDER = '// Welcome to Draw By Numeral!\n// Type a program or click the Help icon [?] for an introduction and examples.\n';

const uniqueName = () => {
	let result = '';
	const alphabet = 'bcdefghjklmnopqrstvwxyz';
	const alphaLength = alphabet.length;
	for (let i = 0; i < 4; i++) {
		result += alphabet.charAt(Math.floor(Math.random() * alphaLength));
	}
	return 'sketch_' + (new Date()).toISOString().match(/^[^T]+/) + '_' + result + '.dbn';
}

let filename = uniqueName();

window.addEventListener('load', function(ee) {
	const sketch = document.getElementById('sketch');
	
	const queryParams = new URLSearchParams(window.location.search);
	const sketchPath = queryParams.get('');

	if (sketchPath && sketchPath.match(/\.dbn$/)) {
		// If there was a sketch path as a query parameter, make an Ajax
		// request for the file contents and fill the sketch textarea.
		this.localStorage.setItem(SHOULD_SHOW_MODAL, 'false');

		axios.get('/' + sketchPath.replace(/^\//, '')).then(response => {
			if ([200, 304].includes(response.status)) {
				sketch.value = response.data;
			}
		}).catch(error => {
			window.location = '/';
		});
	}

	const paper = document.getElementById('paper');
	// The following line mitigates a rendering bug in Safari where a sliver
	// of transparency is visible at the bottom of the image region on the
	// canvas. By setting the element background color to black, it blends in
	// with the surrounding border.
	paper.style.backgroundColor = '#000';
	window.interpreter = new DBN();
	window.interpreter.init(paper);

	const source = this.localStorage.getItem(SKETCH_VALUE_KEY);
	sketch.value = source || SKETCH_DEFAULT_PLACEHOLDER;
	sketch.focus();
	sketch.setSelectionRange(sketch.value.length, sketch.value.length);

	sketch.addEventListener('keydown', function(e) {
		// Override the default tab key behavior to insert four spaces
		// instead of changing focus away from the textarea.
		const TAB_KEY_CODE = 9;
		const TAB_SIZE = 4;
	
		let keyCode = e.keyCode || e.which;
	
		if (keyCode === TAB_KEY_CODE) {
			e.preventDefault();
			document.execCommand('insertText', false, ' '.repeat(TAB_SIZE));
		}
	});

	const highlights = document.getElementById('hl');
	const backdrop = document.getElementById('bk');

	const banner = document.getElementById('message-banner');
	let isBannerPinned = false;
	let sketchModified = false;

	sketch.addEventListener('input', e => {
		const text = e.target.value;
		
		// TODO: Only autosave after no keyboard input for 300ms
		if (text.length < 1000000) {
			this.localStorage.setItem(SKETCH_VALUE_KEY, text);
		}

		filename = uniqueName();

		// On input events, remove all highlights...
		highlights.innerHTML = applyHighlights(text, {start: 0, end: 0});
		// The error message sticks until the input is edited
		isBannerPinned = false;
		sketchModified = true;
		banner.innerHTML = '';
	});

	sketch.addEventListener('scroll', e => {
		backdrop.scrollTop = sketch.scrollTop;
	});

	const escapeArea = document.createElement('textarea');

	const escapeEntities = text => {
		escapeArea.textContent = text;
		return escapeArea.innerHTML;
	};

	const applyHighlights = (text, range, color) => {
		// Insert <mark> tags to span start and end indexes
		let output = '';

		if ((range.start || range.end) && range.start < range.end) {
			output = escapeEntities(text.slice(0, range.start));
			output += '<mark>';
			output += escapeEntities(text.slice(range.start, range.end));
			output += '</mark>';
			output += escapeEntities(text.slice(range.end));
		} else {
			output = escapeEntities(text);
		}

		return output.replace(/\n$/g, '\n\n');
		//texts.join('').replace(/\n$/g, '\n\n');
	};
	
	const highlight = e => {
		if (sketchModified) { return; }

		const text = sketch.value;
		const highlighted = applyHighlights(text, {
			start: e.detail.start.offset,
			end: e.detail.end.offset
		});
		
		highlights.innerHTML = highlighted;
	};

	paper.addEventListener('highlight', highlight, false);


	const playBtn = document.getElementById('play');
	const stopBtn = document.getElementById('stop');
	const openBtn = document.getElementById('open');
	const saveBtn = document.getElementById('save');
	const beautifyBtn = document.getElementById('beautify');
	const helpBtn = document.getElementById('help');
	const closeBtn = document.getElementById('close');
	const modal = document.getElementById('modal');
	
	const file = document.getElementById('fileinput');

	file.addEventListener('change', function(e) {
		const file = e.target.files[0];
		const reader = new FileReader();

		filename = file.name;
		
		reader.readAsText(file,'UTF-8');
		reader.addEventListener('load', function(readerEvent) {
			var content = readerEvent.target.result;
			sketch.value = content;
			window.interpreter.init(paper);
		});
	});

	if (this.localStorage.getItem(SHOULD_SHOW_MODAL) !== 'false') {
		modal.classList.remove('invisible');
		modal.classList.remove('hidden');
	}

	playBtn.addEventListener('mouseover', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = 'Play'
	});
	
	playBtn.addEventListener('mouseout', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = '';
	});
	
	playBtn.addEventListener('click', function(e) {
		const source = sketch.value;

		e.target.classList.add('sticky');
		gtag('event', 'Start', {event_category: 'Execute Sketch'});

		try {
			sketchModified = false;
			window.interpreter.run(source, function() {
				e.target.classList.remove('sticky');
				isBannerPinned = true;
				banner.innerHTML = 'Done.';
				window.setTimeout(() => {
					isBannerPinned = false;
					banner.innerHTML = '';
				}, 3000);
			});
		} catch (err) {
			//ga('send', 'event', 'sketch', 'error', err.message);
			e.target.classList.remove('sticky');
			isBannerPinned = true;

			if (typeof err === 'object') {
				let evt = new CustomEvent('error', {
					detail: {
						message: err.message,
						start: err.start,
						end: err.end
					}
				});
				window.dispatchEvent(evt);
			} else {
				let evt = new Event('error', {
					message: err
				});
				window.dispatchEvent(evt);
				console.error(err.stack);
				throw err;
			}
		}
	});
	
	stopBtn.addEventListener('mouseover', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = 'Stop';
	});
	
	stopBtn.addEventListener('mouseout', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = '';
	});

	stopBtn.addEventListener('click', function(e) {
		playBtn.classList.remove('sticky');

		if (window.interpreter.running) {
			gtag('event', 'Stop', {event_category: 'Execute Sketch'});
			window.interpreter.stop();
			banner.innerHTML = 'Done.';
		}
	});
	
	openBtn.addEventListener('mouseover', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = 'Open';
	});
	
	openBtn.addEventListener('mouseout', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = '';
	});

	openBtn.addEventListener('click', e => {
		playBtn.classList.remove('sticky');

		if (window.interpreter.running) {
			gtag('event', 'Stop', {event_category: 'Execute Sketch'});
			window.interpreter.stop();
			banner.innerHTML = 'Done.';
		}

		file.click();
	});
	
	saveBtn.addEventListener('mouseover', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = 'Save';
	});

	saveBtn.addEventListener('click', e => {
		// consider:
		// uriContent = "data:application/octet-stream," + encodeURIComponent(content);
		const source = sketch.value;
		const pom = document.createElement('a');
		pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(source));
		pom.setAttribute('download', filename);
	
		if (document.createEvent) {
			var event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			pom.dispatchEvent(event);
		} else {
			pom.click();
		}	
	});
	
	saveBtn.addEventListener('mouseout', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = '';
	});
	
	beautifyBtn.addEventListener('mouseover', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = 'Beautify';
	});
	
	beautifyBtn.addEventListener('mouseout', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = '';
	});

	beautifyBtn.addEventListener('click', e => {
		const source = sketch.value;

		try {
			sketch.value = window.interpreter.beautify(source);
		} catch (err) {
			//ga('send', 'event', 'sketch', 'error', err.message);

			if (typeof err === 'object') {
				let evt = new Event('error', {
					detail: {
						message: err.message,
						start: err.start,
						end: err.end
					}
				});
				window.dispatchEvent(evt);
				//banner.innerHTML = err.message;

				/*if (err.start && err.end) {
					// Highlight selection
					const highlighted = applyHighlights(sketch.value, {
						start: err.start.offset,
						end: err.end.offset
					});

					highlights.innerHTML = highlighted;
				} else {
					console.error(err.stack);
					throw err;
				}*/
			} else {
				let evt = new Event('error', {
					message: err
				});
				window.dispatchEvent(evt);
				//banner.innerHTML = err;
				console.error(err.stack);
				throw err;
			}
		}

		if (Event) {
			let evt = new Event('input', {target: sketch});
			sketch.dispatchEvent(evt);
		} else if ('createEvent' in document) {
			let evt = document.createEvent('TextEvent');
			evt.initEvent('input', false, true);
			evt.target = sketch;
			sketch.dispatchEvent(evt);
		} else {
			sketch.fireEvent('input');
		}
	});

	helpBtn.addEventListener('mouseover', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = 'Help';
	});
	
	helpBtn.addEventListener('mouseout', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = '';
	});

	helpBtn.addEventListener('click', function(e) {
		modal.classList.remove('hidden');
		modal.classList.remove('invisible');
	});

	window.addEventListener('error', e => {
		console.error(e);

		if (e.detail) {
			playBtn.classList.remove('sticky');
			isBannerPinned = true;
			banner.innerHTML = e.detail.message;

			if (e.detail.start && e.detail.end) {
				const highlighted = applyHighlights(sketch.value, {
					start: e.detail.start.offset,
					end: e.detail.end.offset
				});

				highlights.innerHTML = highlighted;
			}
		}

		if (window.interpreter.running) {
			// gtag('event', 'Stop', {event_category: 'Execute Sketch'});
			window.interpreter.stop();
		}
	});

	window.addEventListener('keydown', e => {
		
		if (e.altKey) {
			paper.classList.add('screenshot');
		}
	});

	window.addEventListener('keyup', e => {
		paper.classList.remove('screenshot');
	});

	// ========== MODAL ==========

	closeBtn.addEventListener('click', e => {
		this.localStorage.setItem(SHOULD_SHOW_MODAL, 'false');
		modal.classList.add('invisible');
		window.setTimeout(() => {
			modal.classList.add('hidden');
		}, 150);
	});

	const tabs = document.getElementsByClassName('tab');

	for (let i = 0, len = tabs.length; i < len; i++) {
		tabs.item(i).addEventListener('click', e => {
			if (!e.target.classList.contains('selected')) {
				let selected = document.getElementsByClassName('tab selected');

				for (let j = 0, len = selected.length; j < len; j++) {
					let id = selected.item(j).getAttribute('id').replace(/-tab$/, '-card');
					document.getElementById(id).classList.add('hidden');
					selected.item(j).classList.remove('selected');
				}

				e.target.classList.add('selected');

				let newID = e.target.getAttribute('id').replace(/-tab$/, '-card');
				document.getElementById(newID).classList.remove('hidden');
			}
		});
	}

	const win = document.getElementById('tut-window');
	const links = document.getElementsByClassName('tut-hover');

	win.style.backgroundImage = "url('" + win.getAttribute('data-bg-src') + "')";

	for (let i = 0, len = links.length; i < len; i++) {
		const a = links.item(i);
		
		a.addEventListener('mouseover', e => {
			win.src = e.target.getAttribute('data-img-src');
		});

		a.addEventListener('mouseout', e => {
			win.src = "/assets/window.gif";
		});

		a.addEventListener('click', e => e.preventDefault());
	}
});

