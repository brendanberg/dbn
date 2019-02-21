/* Draw By Numeral
 * by Brendan Berg
 * 
 * main.js initializes the PixelPusher VM and connects window UI elements to
 * their desired actions. That's it :)
 */

import DBN from './dbn';

window.addEventListener('load', function(ee) {
	const paper = document.getElementById('paper');
	window.interpreter = new DBN();
	window.interpreter.init(paper);


	const sketch = document.getElementById('sketch');
	
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

	sketch.addEventListener('input', e => {
		const text = e.target.value;
		// On input events, remove all highlights...
		highlights.innerHTML = applyHighlights(text, {start: 0, end: 0});
		// The error message sticks until the input is edited
		isBannerPinned = false;
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
		// 
		
		let output = '';

		if (range.start && range.end && range.start < range.end) {
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
	const closeBtn = document.getElementById('close');
	const modal = document.getElementById('modal');
	
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
				banner.innerHTML = err.message;

				if (err.start && err.end) {
					// Highlight selection
					const highlighted = applyHighlights(sketch.value, {
						start: err.start.offset,
						end: err.end.offset
					});

					highlights.innerHTML = highlighted;
				} else {
					console.error(err.stack);
					throw err;
				}
			} else {
				banner.innerHTML = err;
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
		modal.classList.remove('hidden');
		modal.classList.remove('invisible');
	});
	
	saveBtn.addEventListener('mouseover', function(e) {
		if (isBannerPinned) { return; }
		banner.innerHTML = 'Save';
	});

	saveBtn.addEventListener('click', e => {
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


	// ========== MODAL ==========

	closeBtn.addEventListener('click', e => {
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

