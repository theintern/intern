(function () {
	/* global hljs:false */
	var showMenu = document.getElementById('showMenu');
	var menu = document.getElementById('tableOfContents');
	var isOpen = false;
	showMenu.ontouchstart = showMenu.onpointerdown = showMenu.onclick = function (event) {
		if (!event.pointerType || event.pointerType === 'touch') {
			event.preventDefault();
		}

		isOpen = !isOpen;
		menu.classList.toggle('open', isOpen);
		showMenu.setAttribute('aria-expanded', String(isOpen));
	};

	function close(event) {
		if (isOpen && !menu.contains(event.target) && !showMenu.contains(event.target)) {
			event.preventDefault();
			isOpen = false;
			menu.classList.remove('open');
			showMenu.setAttribute('aria-expanded', 'false');
		}
	}

	document.addEventListener('touchstart', close, false);
	document.addEventListener('pointerdown', close, false);
	document.addEventListener('mousedown', close, false);

	var main = document.getElementById('main');
	var headers = main.querySelectorAll('h3');

	/**
	 * The fold point represents a line on the viewport y-axis. The nearest section above the top of this line is
	 * considered the currently active section. Change this value to change how far up the viewport a section needs to
	 * be scrolled before it becomes the active section.
	 */
	var foldPoint = window.innerHeight * 0.3;

	/**
	 * @type HTMLElement
	 */
	var activeSection;

	/**
	 * @type HTMLElement
	 */
	var activeSubsection;

	/**
	 * @const
	 */
	var defaultTitle = document.title;

	var lastHash;
	var requestId;

	/**
	 * Finds the currently active section of the document according to the current scroll position.
	 */
	function findActiveSection() {
		var i = headers.length - 1;
		var header;
		for (; (header = headers[i]); --i) {
			if (header.getBoundingClientRect().top < foldPoint) {
				return header.dataset.id;
			}
		}
	}

	/**
	 * Sets the height of the currently active section’s list of subsections in the main menu so that CSS transitions
	 * on height can be performed correctly (CSS does not currently allow animation to/from auto).
	 */
	function fixSubsectionHeight() {
		var activeSubsections = activeSection.querySelector('.subsections');
		activeSubsections.style.maxHeight = activeSubsections.scrollHeight + 'px';
	}

	function resetSection() {
		setActiveSection(findActiveSection());
	}

	/**
	 * Sets the correct state of the sidebar, document title, and page hash to match the provided section ID.
	 * TODO: Split this so that the menu state can be set independently from the scroll/hash, for cases where we are
	 * linking to non-sections within the document.
	 */
	function setActiveSection(id) {
		if (lastHash === id) {
			return;
		}

		activeSubsection && activeSubsection.classList.remove('active');
		activeSubsection = menu.querySelector('[data-id="' + id + '"]');
		if (activeSubsection) {
			// `id` is a main section; find the first subsection
			if (activeSubsection.querySelector('.subsections')) {
				activeSubsection = activeSubsection.querySelector('.subsections').firstElementChild;
				id = activeSubsection.getAttribute('data-id');
			}

			document.title = defaultTitle + ': ' + activeSubsection.textContent;
			activeSubsection.classList.add('active');
			var anchor = document.getElementById(id);
			anchor.id = '';
			location.replace('#' + id);
			anchor.id = id;
		}
		var newActiveSection = activeSubsection && activeSubsection.parentNode.parentNode;
		if (newActiveSection !== activeSection) {
			if (activeSection) {
				activeSection.classList.remove('active');
				activeSection.querySelector('.subsections').style.maxHeight = '';
			}

			activeSection = newActiveSection;

			if (activeSection) {
				activeSection.classList.add('active');
				if (window.fontsActivated) {
					fixSubsectionHeight();
				}
				else if (!window.onTypekitActive) {
					window.onTypekitActive = fixSubsectionHeight;
				}
			}
		}
	}

	window.addEventListener('hashchange', function () {
		if (requestId) {
			cancelAnimationFrame(requestId);
			requestId = null;
		}

		var newHash = location.hash.slice(1);
		setActiveSection(newHash);
	}, false);
	window.addEventListener('resize', function () {
		foldPoint = window.innerHeight * 0.3;
		resetSection();
	}, false);
	window.addEventListener('scroll', function () {
		// scroll event happens before hashchange event when someone clicks on a link or uses back/forward buttons
		// and does not identify what the scroll initiator was, so defer until the next render frame to avoid
		// accidentally moving the user to the wrong hash when linking to a non-section in the document
		requestId = requestAnimationFrame(resetSection);
	}, false);

	// Hack to deal with https://bugzilla.mozilla.org/show_bug.cgi?id=1134098
	// and https://code.google.com/p/chromium/issues/detail?id=459476 without
	// spending the time right now to rewrite all the documentation to use
	// soft tabs or a markdown-to-html generator
	(function fixTabs() {
		Array.prototype.slice.call(document.querySelectorAll('pre'), 0).forEach(function (pre) {
			pre.innerHTML = pre.innerHTML.replace(/\t/g, '  ');
		});
	})();

	(function highlightCode() {
		var selectorsToFind = hljs.listLanguages().map(function (language) {
			return 'code.' + language + ', samp.' + language;
		});

		Array.prototype.slice.call(document.querySelectorAll(selectorsToFind.join(',')), 0).forEach(function (block) {
			hljs.highlightBlock(block);
		});
	})();
})();
