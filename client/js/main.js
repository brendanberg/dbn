/* Draw By Numeral
 * (c) Brendan Berg 2019-2024
 *
 * main.js initializes the PixelPusher VM and connects window UI elements to
 * their desired actions. That's it :)
 */
import axios from 'axios';
import DBN from './dbn';

const MODAL_SHOW_AT_STARTUP_KEY = 'environment:modal:showAtStartup';
const SKETCH_VALUE_KEY = 'environment:sketch.value';

const SKETCH_DEFAULT_PLACEHOLDER =
    '// Welcome to Draw By Numeral!\n// Type a program or click the Help icon (i) for an introduction and examples.\n';

const uniqueName = () => {
    let result = '';
    const alphabet = 'bcdefghjklmnopqrstvwxyz';
    const alphaLength = alphabet.length;
    for (let i = 0; i < 4; i++) {
        result += alphabet.charAt(Math.floor(Math.random() * alphaLength));
    }
    return 'sketch_' + new Date().toISOString().match(/^[^T]+/) + '_' + result + '.dbn';
};

let filename = uniqueName();

window.addEventListener('load', function (ee) {
    const sketch = document.getElementById('sketch');

    const queryParams = new URLSearchParams(window.location.search);
    const sketchPath = queryParams.get('');

    if (sketchPath && sketchPath.match(/\.dbn$/)) {
        // If there was a sketch path as a query parameter, make an Ajax
        // request for the file contents and fill the sketch textarea.
        this.localStorage.setItem(MODAL_SHOW_AT_STARTUP_KEY, 'false');

        axios
            .get('/' + sketchPath.replace(/^\//, ''))
            .then((response) => {
                if ([200, 304].includes(response.status)) {
                    sketch.value = response.data;
                }
            })
            .catch((error) => {
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

    sketch.addEventListener('keydown', function (e) {
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

    sketch.addEventListener('input', (e) => {
        const text = e.target.value;

        // TODO: Only autosave after no keyboard input for 300ms
        if (text.length < 1000000) {
            this.localStorage.setItem(SKETCH_VALUE_KEY, text);
        }

        filename = uniqueName();

        // On input events, remove all highlights...
        highlights.innerHTML = applyHighlights(text, { start: 0, end: 0 });
        // The error message sticks until the input is edited
        isBannerPinned = false;
        sketchModified = true;
        banner.innerHTML = '';
    });

    sketch.addEventListener('scroll', (e) => {
        backdrop.scrollTop = sketch.scrollTop;
    });

    const escapeArea = document.createElement('textarea');

    const escapeEntities = (text) => {
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

    const highlight = (e) => {
        if (sketchModified) {
            return;
        }

        const text = sketch.value;
        const highlighted = applyHighlights(text, {
            start: e.detail.start.offset,
            end: e.detail.end.offset,
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
    const openCloseBtn = document.getElementById('open-close');
    const helpCloseBtn = document.getElementById('help-close');
    const openModal = document.getElementById('open-modal');
    const helpModal = document.getElementById('help-modal');

    const file = document.getElementById('fileinput');

    file.addEventListener('change', function (e) {
        const file = e.target.files[0];
        const reader = new FileReader();

        filename = file.name;

        openCloseBtn.dispatchEvent(new Event('click'));

        reader.readAsText(file, 'UTF-8');
        reader.addEventListener('load', function (readerEvent) {
            var content = readerEvent.target.result;
            sketch.value = content;
            window.interpreter.init(paper);
        });
    });

    if (this.localStorage.getItem(MODAL_SHOW_AT_STARTUP_KEY) !== 'false') {
        helpModal.classList.remove('invisible');
        helpModal.classList.remove('hidden');
    }

    playBtn.addEventListener('mouseover', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = 'Play';
    });

    playBtn.addEventListener('mouseout', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = '';
    });

    playBtn.addEventListener('click', async function (e) {
        const source = sketch.value;
        gtag('event', 'Start', { event_category: 'Execute Sketch' });

        try {
            sketchModified = false;
            await window.interpreter.run(source);
        } catch (err) {
            //ga('send', 'event', 'sketch', 'error', err.message);
            e.target.classList.remove('sticky');
            isBannerPinned = true;

            if (typeof err === 'object') {
                let evt = new CustomEvent('error', {
                    detail: {
                        message: err.message,
                        start: err.start,
                        end: err.end,
                    },
                });
                window.dispatchEvent(evt);
            } else {
                let evt = new Event('error', {
                    message: err,
                });
                window.dispatchEvent(evt);
                console.error(err.stack);
                throw err;
            }
        }
    });

    stopBtn.addEventListener('mouseover', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = 'Stop';
    });

    stopBtn.addEventListener('mouseout', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = '';
    });

    stopBtn.addEventListener('click', function (e) {
        playBtn.classList.remove('sticky');

        if (window.interpreter.running) {
            gtag('event', 'Stop', { event_category: 'Execute Sketch' });
            window.interpreter.stop();
            banner.innerHTML = 'Done.';
        }
    });

    openBtn.addEventListener('mouseover', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = 'Open';
    });

    openBtn.addEventListener('mouseout', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = '';
    });

    openBtn.addEventListener('click', (e) => {
        playBtn.classList.remove('sticky');

        if (window.interpreter.running) {
            gtag('event', 'Stop', { event_category: 'Execute Sketch' });
            window.interpreter.stop();
            banner.innerHTML = 'Done.';
        }

        // file.click();
        openModal.classList.remove('hidden');
        openModal.classList.remove('invisible');
    });

    saveBtn.addEventListener('mouseover', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = 'Save';
    });

    saveBtn.addEventListener('click', (e) => {
        const source = document.createElement('a');
        source.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(sketch.value));
        source.setAttribute('download', filename);

        if (document.createEvent) {
            // We know it's deprecated. This is here for compatibility.
            var event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            source.dispatchEvent(event);
        } else {
            source.click();
        }
    });

    saveBtn.addEventListener('mouseout', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = '';
    });

    beautifyBtn.addEventListener('mouseover', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = 'Beautify';
    });

    beautifyBtn.addEventListener('mouseout', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = '';
    });

    beautifyBtn.addEventListener('click', (e) => {
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
                        end: err.end,
                    },
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
                    message: err,
                });
                window.dispatchEvent(evt);
                //banner.innerHTML = err;
                console.error(err.stack);
                throw err;
            }
        }

        if (Event) {
            let evt = new Event('input', { target: sketch });
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

    helpBtn.addEventListener('mouseover', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = 'Help';
    });

    helpBtn.addEventListener('mouseout', function (e) {
        if (isBannerPinned) {
            return;
        }
        banner.innerHTML = '';
    });

    helpBtn.addEventListener('click', function (e) {
        helpModal.classList.remove('hidden');
        helpModal.classList.remove('invisible');
    });

    window.addEventListener('error', (e) => {
        console.error(e);

        if (e.detail) {
            playBtn.classList.remove('sticky');
            isBannerPinned = true;
            banner.innerHTML = e.detail.message;

            if (e.detail.start && e.detail.end) {
                const highlighted = applyHighlights(sketch.value, {
                    start: e.detail.start.offset,
                    end: e.detail.end.offset,
                });

                highlights.innerHTML = highlighted;
            }
        }

        if (window.interpreter.running) {
            // gtag('event', 'Stop', {event_category: 'Execute Sketch'});
            window.interpreter.stop();
        }
    });

    this.window.addEventListener('vmstart', (e) => {
        playBtn.classList.add('sticky');
    });

    this.window.addEventListener('vmstop', (e) => {
        playBtn.classList.remove('sticky');
        isBannerPinned = true;
        banner.innerHTML = 'Done.';
        window.setTimeout(() => {
            isBannerPinned = false;
            banner.innerHTML = '';
        }, 3000);
    });

    window.addEventListener('keydown', (e) => {
        if (e.altKey) {
            paper.classList.add('screenshot');
        }
    });

    window.addEventListener('keyup', (e) => {
        paper.classList.remove('screenshot');
    });

    /* ************* *
     *  Drop Target  *
     * ************* */

    let modalErrorTimeout = undefined;
    const droptarget = document.getElementById('droptarget');

    droptarget.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.target.classList.add('hover');

        // swap paragraphs
        const paragraphs = droptarget.getElementsByTagName('p');

        for (let i = 0, len = paragraphs.length; i < len; i++) {
            const paragraph = paragraphs.item(i);

            if (paragraph.classList.contains('marker')) {
                paragraph.classList.remove('red');
                paragraph.innerText = 'Drop sketch file here';
                paragraph.classList.remove('hidden');
                paragraph.classList.remove('invisible');
            } else {
                paragraph.classList.add('hidden');
                paragraph.classList.add('invisible');
            }
        }

        if (modalErrorTimeout !== undefined) {
            this.window.clearTimeout(modalErrorTimeout);
        }
    });

    droptarget.addEventListener('mouseup', (e) => {
        if (e.target.classList.contains('hover')) {
            e.target.classList.remove('hover');
        }

        const paragraphs = droptarget.getElementsByTagName('p');

        for (let i = 0, len = paragraphs.length; i < len; i++) {
            const paragraph = paragraphs.item(i);

            if (paragraph.classList.contains('marker')) {
                paragraph.classList.add('hidden');
                paragraph.classList.add('invisible');
            } else {
                paragraph.classList.remove('hidden');
                paragraph.classList.remove('invisible');
            }
        }
    });

    droptarget.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    droptarget.addEventListener('dragleave', (e) => {
        const rect = droptarget.getBoundingClientRect();
        if (!(rect.top < e.y && rect.bottom > e.y && rect.left < e.x && rect.right > e.x)) {
            e.target.classList.remove('hover');

            const paragraphs = droptarget.getElementsByTagName('p');

            for (let i = 0, len = paragraphs.length; i < len; i++) {
                const paragraph = paragraphs.item(i);

                if (paragraph.classList.contains('marker')) {
                    paragraph.classList.add('hidden');
                    paragraph.classList.add('invisible');
                } else {
                    paragraph.classList.remove('hidden');
                    paragraph.classList.remove('invisible');
                }
            }
        }
    });

    droptarget.addEventListener('drop', (e) => {
        e.target.classList.remove('hover');
        e.preventDefault();

        const filelist = e.dataTransfer.files;

        if (filelist.length == 1) {
            const reader = new FileReader();

            reader.addEventListener('load', (e) => {
                sketch.value = e.target.result;
                window.interpreter.init(paper);
            });

            reader.readAsText(filelist.item(0));
            openCloseBtn.dispatchEvent(new Event('click'));

            const paragraphs = droptarget.getElementsByTagName('p');

            for (let i = 0, len = paragraphs.length; i < len; i++) {
                const paragraph = paragraphs.item(i);

                if (paragraph.classList.contains('marker')) {
                    paragraph.classList.add('hidden');
                    paragraph.classList.add('invisible');
                } else {
                    paragraph.classList.remove('hidden');
                    paragraph.classList.remove('invisible');
                }
            }
        } else {
            const paragraphs = droptarget.getElementsByTagName('p');

            for (let i = 0, len = paragraphs.length; i < len; i++) {
                const paragraph = paragraphs.item(i);

                if (paragraph.classList.contains('marker')) {
                    paragraph.classList.add('red');
                    paragraph.innerText = 'Please only drop one file';

                    modalErrorTimeout = this.window.setTimeout(() => {
                        const paragraphs = droptarget.getElementsByTagName('p');

                        for (let i = 0, len = paragraphs.length; i < len; i++) {
                            const paragraph = paragraphs.item(i);

                            if (paragraph.classList.contains('marker')) {
                                paragraph.classList.remove('red');
                                paragraph.innerText = 'Drop sketch file here';
                                paragraph.classList.add('hidden');
                                paragraph.classList.add('invisible');
                            } else {
                                paragraph.classList.remove('hidden');
                                paragraph.classList.remove('invisible');
                            }
                        }
                    }, 5000);
                }

                // Add error message that fades out after n seconds
                // TODO: Add timeout
            }
        }
    });

    /* ******************* *
     *  File Browser Link  *
     * ******************* */

    this.document.getElementById('uploadlink').addEventListener('click', (e) => {
        e.preventDefault();
        file.click();
    });

    /* *************************** *
     *  Enable Tabs on All Modals  *
     * *************************** */

    const modals = document.getElementsByClassName('modal');

    for (let i = 0, len = modals.length; i < len; i++) {
        const modal = modals.item(i);
        const tabs = modal.getElementsByClassName('tab');

        for (let j = 0, len = tabs.length; j < len; j++) {
            const tab = tabs.item(j);

            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('selected')) {
                    const selecteds = modal.getElementsByClassName('tab selected');

                    for (let k = 0, len = selecteds.length; k < len; k++) {
                        const selected = selecteds.item(k);
                        const id = selected.getAttribute('id').replace(/-tab$/, '-card');
                        document.getElementById(id).classList.add('hidden');
                        selected.classList.remove('selected');
                    }

                    e.target.classList.add('selected');

                    const newID = e.target.getAttribute('id').replace(/-tab$/, '-card');
                    document.getElementById(newID).classList.remove('hidden');
                }
            });
        }
    }

    /* ************ *
     *  Open Modal  *
     * ************ */

    openCloseBtn.addEventListener('click', (e) => {
        openModal.classList.add('invisible');
        this.window.setTimeout(() => {
            openModal.classList.add('hidden');
        }, 150);
    });

    // ========== HELP MODAL ==========

    helpCloseBtn.addEventListener('click', (e) => {
        this.localStorage.setItem(MODAL_SHOW_AT_STARTUP_KEY, 'false');
        helpModal.classList.add('invisible');
        window.setTimeout(() => {
            helpModal.classList.add('hidden');
        }, 150);
    });

    const win = document.getElementById('tut-window');
    const links = document.getElementsByClassName('tut-hover');

    win.style.backgroundImage = "url('" + win.getAttribute('data-bg-src') + "')";

    for (let i = 0, len = links.length; i < len; i++) {
        const a = links.item(i);

        a.addEventListener('mouseover', (e) => {
            win.src = e.target.getAttribute('data-img-src');
        });

        a.addEventListener('mouseout', (e) => {
            win.src = '/assets/window.gif';
        });

        a.addEventListener('click', (e) => e.preventDefault());
    }
});
