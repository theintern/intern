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
	var foldPoint = window.innerHeight * 0.3;
	var activeSection;
	var activeSubsection;
	var defaultTitle = document.title;

	function findActiveSection() {
		var i = headers.length - 1;
		var header;
		for (; (header = headers[i]); --i) {
			if (header.getBoundingClientRect().top < foldPoint) {
				var id = header.dataset.id;
				setActiveSection(id);
				return;
			}
		}
	}

	function setActiveSection(id) {
		activeSubsection && activeSubsection.classList.remove('active');
		activeSubsection = menu.querySelector('[data-id="' + id + '"]');
		if (activeSubsection) {
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
				var activeSubsections = activeSection.querySelector('.subsections');
				activeSubsections.style.maxHeight = activeSubsections.scrollHeight + 'px';
			}
		}
	}

	window.addEventListener('resize', function () {
		foldPoint = window.innerHeight * 0.3;
		findActiveSection();
	}, false);
	window.addEventListener('scroll', findActiveSection, false);

	var selectorsToFind = hljs.listLanguages().map(function (language) {
		return 'code.' + language + ', samp.' + language;
	});

	Array.prototype.slice.call(document.querySelectorAll(selectorsToFind.join(',')), 0).forEach(function (block) {
		hljs.highlightBlock(block);
	});

	// At least Chrome does not scroll to the initial fragment position until some point after this script executes,
	// so we will do it for it
	if (location.hash) {
		(function () {
			var initialId = location.hash.slice(1);
			var initialSectionElement = document.getElementById(initialId);
			if (initialSectionElement) {
				initialSectionElement.scrollIntoView();
				setActiveSection(initialId);
			}
			else {
				findActiveSection();
			}
		})();
	}
	else {
		findActiveSection();
	}
})();
