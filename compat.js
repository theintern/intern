var Command = require('./Command');
var Promise = require('dojo/Promise');
var strategies = require('./strategies');
var topic = require('dojo/topic');

/**
 * Deprecates `fromMethod` for `toMethod` and returns the correct call to `toMethod`.
 *
 * @param {string} fromMethod
 * @param {string} toMethod
 * @returns {Function}
 */
function deprecate(fromMethod, toMethod) {
	return function () {
		warn('Command#' + fromMethod, 'Command#' + toMethod);
		return this[toMethod].apply(this, arguments);
	};
}

/**
 * Deprecates the element context signature of a method and returns a new command with the correct call to
 * `toMethod` on the element.
 *
 * @param {string} fromMethod
 * The name of the old method.
 *
 * @param {string=} toMethod
 * The name of the replacement method on the element, if it is different than the name of the old method. If
 * omitted, it is assumed that the method name
 *
 * @param {Function=} fn
 * An optional function that will be invoked in lieu of a call to the original method if a non-element signature
 * is used.
 *
 * @returns {Function}
 */
function deprecateElementSig(fromMethod, toMethod, fn) {
	return function (element) {
		if (element && element.elementId) {
			warn('Command#' + fromMethod + '(element)', 'Command#getElement then Command#' + fromMethod + ', or ' +
				'Command#getElement then Command#then(function (element) { return element.' +
				(toMethod || fromMethod) + '(); }');

			var args = Array.prototype.slice.call(arguments, 1);
			return new Command(this, function () {
				return element[toMethod || fromMethod].apply(this, args);
			});
		}

		return fn ? fn.apply(this, arguments) : Command.prototype[fromMethod].apply(this, arguments);
	};
}

/**
 * Deprecates the element context signature of a method as well as its non-element signature to go to `toMethod`.
 *
 * @param {string} fromMethod
 * @param {string} toMethod
 * @returns {Function}
 */
function deprecateElementAndStandardSig(fromMethod, toMethod) {
	return deprecateElementSig(fromMethod, toMethod, deprecate(fromMethod, toMethod));
}

function elementIfExists(using, value) {
	return this.getElement(using, value).otherwise(function () {});
}

function elementOrNull(using, value) {
	return this.getElement(using, value).otherwise(function () {
		return null;
	});
}

function hasElement(using, value) {
	return this.getElement(using, value).then(function () {
		return true;
	}, function () {
		return false;
	});
}

function waitForElement(using, value, timeout) {
	return this.getImplicitWaitTimeout().then(function (originalTimeout) {
		return this.setImplicitWaitTimeout(timeout)
			.getElement(using, value)
			.then(function (element) {
				return this.setImplicitWaitTimeout(originalTimeout).then(function () {
					return element;
				});
			}, function (error) {
				return this.setImplicitWaitTimeout(originalTimeout).then(function () {
					throw error;
				});
			});
	});
}

function waitForVisible(using, value, timeout) {
	var startTime = Date.now();
	return this.getImplicitWaitTimeout().then(function (originalTimeout) {
		return this.setImplicitWaitTimeout(timeout)
			.getElement(using, value)
			.then(function (element) {
				return this.executeAsync(/* istanbul ignore next */ function (element, timeout, done) {
					var startTime = +new Date();
					(function poll() {
						if (element.offsetWidth && element.offsetHeight) {
							done(true);
						}
						else if (+new Date() - startTime > timeout) {
							done(false);
						}
						else {
							setTimeout(poll, 200);
						}
					})();
				}, [ element, timeout - (startTime - Date.now()) ]);
			}).then(function (isVisible) {
				return this.setImplicitWaitTimeout(originalTimeout).then(function () {
					if (!isVisible) {
						throw new Error('Element didn\'t become visible');
					}
				});
			}, function (error) {
				return this.setImplicitWaitTimeout(originalTimeout).then(function () {
					throw error;
				});
			});
	});
}

/**
 * Warns a user once that the method given by `name` is deprecated.
 *
 * @method
 * @param {string} name The name of the old method.
 * @param {string=} replacement Replacement instructions, if a direct replacement for the old method exists.
 * @param {string=} extra Extra information about the deprecation.
 */
var warn = (function () {
	var warned = {};
	return function (name, replacement, extra) {
		if (warned[name]) {
			return;
		}

		warned[name] = true;
		topic.publish('/deprecated', name, replacement, extra);
	};
})();

var methods = {
	get sessionID() {
		warn('Command#sessionID', 'the Command#session.sessionId property');
		return this.session.sessionId;
	},
	status: function () {
		warn('Command#status');
		return new Command(this, function () {
			return this.session.server.getStatus();
		});
	},
	init: function () {
		warn('Command#init');
		return this;
	},
	sessions: function () {
		warn('Command#sessions');
		return new Command(this, function () {
			return this.session.server.getSessions();
		});
	},
	sessionCapabilities: function () {
		warn('Command#sessionCapabilities', 'the Command#session.capabilities property');
		return new Command(this, function () {
			return this.session.capabilities;
		});
	},
	altSessionCapabilities: function () {
		warn('Command#altSessionCapabilities', 'the Command#session.capabilities property');
		return new Command(this, function () {
			return this.session.capabilities;
		});
	},
	getSessionId: function () {
		warn('Command#getSessionId', 'the Command#session.sessionId property');
		return new Command(this, function () {
			return this.session.sessionId;
		});
	},
	getSessionID: function () {
		warn('Command#getSessionID', 'the Command#session.sessionId property');
		return new Command(this, function () {
			return this.session.sessionId;
		});
	},
	setAsyncScriptTimeout: deprecate('setAsyncScriptTimeout', 'setExecuteAsyncTimeout'),
	setWaitTimeout: deprecate('setWaitTimeout', 'setImplicitTimeout'),
	setImplicitWaitTimeout: deprecate('setImplicitWaitTimeout', 'setImplicitTimeout'),
	windowHandle: deprecate('windowHandle', 'getCurrentWindowHandle'),
	windowHandles: deprecate('windowHandles', 'getAllWindowHandles'),
	url: deprecate('url', 'getCurrentUrl'),
	forward: deprecate('forward', 'goForward'),
	back: deprecate('back', 'goBack'),
	safeExecute: deprecate('safeExecute', 'execute'),
	eval: function (code) {
		warn('Command#eval', 'Command#execute with a return call');
		return this.execute('return (' + code + ')');
	},
	safeEval: function (code) {
		warn('Command#safeEval', 'Command#execute with a return call');
		return this.execute('return (' + code + ')');
	},
	safeExecuteAsync: deprecate('safeExecuteAsync', 'executeAsync'),
	frame: deprecate('frame', 'switchToFrame'),
	window: deprecate('window', 'switchToWindow'),
	close: deprecate('close', 'closeCurrentWindow'),
	windowSize: deprecate('windowSize', 'setWindowSize'),
	setWindowSize: function () {
		var args = Array.prototype.slice.call(arguments, 0);

		if (args.length === 3 && typeof args[0] === 'number') {
			deprecate('Command#setWindowSize(width, height, handle)',
				'Command#setWindowSize(handle, width, height)');
			args.unshift(args.pop());
		}

		return Command.prototype.setWindowSize.apply(this, args);
	},
	setWindowPosition: function () {
		var args = Array.prototype.slice.call(arguments, 0);

		if (args.length === 3 && typeof args[0] === 'number') {
			deprecate('Command#setWindowPosition(x, y, handle)',
				'Command#setWindowSize(handle, x, y)');
			args.unshift(args.pop());
		}

		return Command.prototype.setWindowPosition.apply(this, args);
	},
	maximize: deprecate('maximize', 'maximizeWindow'),
	allCookies: deprecate('allCookies', 'getCookies'),
	deleteAllCookies: deprecate('deleteAllCookies', 'clearCookies'),
	source: deprecate('source', 'getPageSource'),
	title: deprecate('title', 'getPageTitle'),
	element: deprecate('element', 'getElement'),
	elementByClassName: deprecate('elementByClassName', 'getElementByClassName'),
	elementByCssSelector: deprecate('elementByCssSelector', 'getElementByCssSelector'),
	elementById: deprecate('elementById', 'getElementById'),
	elementByName: deprecate('elementByName', 'getElementByName'),
	elementByLinkText: deprecate('elementByLinkText', 'getElementByLinkText'),
	elementByPartialLinkText: deprecate('elementByPartialLinkText', 'getElementByPartialLinkText'),
	elementByTagName: deprecate('elementByTagName', 'getElementByTagName'),
	elementByXPath: deprecate('elementByXPath', 'getElementByXpath'),
	elementByCss: deprecate('elementByCss', 'getElementByCssSelector'),
	elements: deprecate('elements', 'getElements'),
	elementsByClassName: deprecate('elementsByClassName', 'getElementsByClassName'),
	elementsByCssSelector: deprecate('elementsByCssSelector', 'getElementsByCssSelector'),
	elementsById: function (value) {
		warn('Command#elementsById', 'Command#getElementById');
		return this.getElements('id', value);
	},
	elementsByName: deprecate('elementsByName', 'getElementsByName'),
	elementsByLinkText: deprecate('elementsByLinkText', 'getElementsByLinkText'),
	elementsByPartialLinkText: deprecate('elementsByPartialLinkText', 'getElementsByPartialLinkText'),
	elementsByTagName: deprecate('elementsByTagName', 'getElementsByTagName'),
	elementsByXPath: deprecate('elementsByXPath', 'getElementsByXpath'),
	elementsByCss: deprecate('elementsByCss', 'getElementsByCssSelector'),
	elementOrNull: function () {
		warn('Command#elementOrNull', 'Command#getElement and Command#always, or Command#getElements');
		return elementOrNull.apply(this, arguments);
	},
	elementIfExists: function () {
		warn('Command#elementIfExists', 'Command#getElement and Command#always, or Command#getElements');
		return elementIfExists.apply(this, arguments);
	},
	hasElement: function () {
		warn('Command#hasElement', 'Command#getElement and Command#then(exists, doesNotExist)');
		return hasElement.apply(this, arguments);
	},
	active: deprecate('active', 'getActiveElement'),
	clickElement: deprecateElementSig('clickElement', 'click'),
	submit: deprecateElementSig('submit'),
	text: deprecateElementAndStandardSig('text', 'getVisibleText'),

	// This method had a two-argument version according to the WD.js docs but they inexplicably swapped the first
	// and second arguments so it probably never would have worked properly in Intern
	textPresent: function (searchText, element) {
		warn('Command#textPresent', 'Command#getVisibleText and a promise helper');

		function test(text) {
			return text.indexOf(searchText) > -1;
		}

		if (element) {
			return new Command(this, function () {
				return element.getVisibleText().then(test);
			});
		}

		return this.getVisibleText().then(test);
	},

	// This is not backwards-compatible because it is impossible to know whether someone is expecting this to
	// work like the old element `type` because they have not converted their code yet, or like the new session
	// `type` because they have
	type: deprecateElementSig('type', 'type'),

	keys: deprecate('keys', 'type'),
	getTagName: deprecateElementSig('getTagName'),
	clear: deprecateElementAndStandardSig('clear', 'clearValue'),
	isSelected: deprecateElementSig('isSelected'),
	isEnabled: deprecateElementSig('isEnabled'),
	enabled: deprecateElementAndStandardSig('enabled', 'isEnabled'),
	getAttribute: deprecateElementSig('getAttribute'),
	getValue: function (element) {
		if (element && element.elementId) {
			warn('Command#getValue(element)', 'Command#getElement then Command#getAttribute(\'value\'), or ' +
				'Command#getElement then Command#then(function (element) { ' +
				'return element.getAttribute(\'value\'); }');

			return new Command(this, function () {
				return element.getAttribute('value');
			});
		}

		return this.getAttribute('value');
	},
	equalsElement: function (element, other) {
		warn('Command#equalsElement');

		return new Command(this, function () {
			return element.equals(other);
		});
	},
	isDisplayed: deprecateElementSig('isDisplayed'),
	displayed: deprecateElementAndStandardSig('displayed', 'isDisplayed'),
	getLocation: deprecateElementAndStandardSig('getLocation', 'getPosition'),
	getLocationInView: function () {
		warn(
			'Command#getLocationInView',
			'Command#getLocation',
			'This command is defined in the spec as internal and should never have been exposed to end users. ' +
			'The returned value of this command will be the same as Command#getPosition, which may not match ' +
			'prior behaviour.'
		);

		return this.getPosition.apply(this, arguments);
	},
	getSize: deprecateElementSig('getSize'),
	getComputedCss: deprecateElementAndStandardSig('getComputedCss', 'getComputedStyle'),
	getComputedCSS: deprecateElementAndStandardSig('getComputedCSS', 'getComputedStyle'),
	alertText: deprecate('alertText', 'getAlertText'),
	alertKeys: deprecate('alertKeys', 'typeInPrompt'),
	moveTo: deprecateElementAndStandardSig('moveTo', 'moveMouseTo'),
	click: deprecateElementSig('click'),
	buttonDown: deprecate('buttonDown', 'pressMouseButton'),
	buttonUp: deprecate('buttonUp', 'releaseMouseButton'),
	doubleclick: deprecate('doubleclick', 'doubleClick'),
	// TODO: There is no tap on elements
	tapElement: deprecateElementSig('tapElement', 'tap'),
	// TODO: There is no flick on elements
	flick: deprecate('flick', 'flickFinger'),
	setLocalStorageKey: deprecate('setLocalStorageKey', 'setLocalStorageItem'),
	getLocalStorageKey: deprecate('getLocalStorageKey', 'getLocalStorageItem'),
	removeLocalStorageKey: deprecate('removeLocalStorageKey', 'deleteLocalStorageItem'),
	log: deprecate('log', 'getLogsFor'),
	logTypes: deprecate('logTypes', 'getAvailableLogTypes'),
	newWindow: function (url, name) {
		warn('Command#newWindow', 'Command#execute');
		return this.execute('window.open(arguments[0], arguments[1]);', [ url, name ]);
	},
	windowName: function () {
		warn('Command#windowName', 'Command#execute');
		return this.execute('return window.name;');
	},
	setHTTPInactivityTimeout: function () {
		warn('Command#setHTTPInactivityTimeout');
		return this;
	},
	getPageIndex: function (element) {
		warn('Command#getPageIndex', null, 'This command is not part of any specification.');
		if (element && element.elementId) {
			return new Command(this, function () {
				return element._get('pageIndex');
			});
		}

		return new Command(this, function () {
			if (this.context.isSingle) {
				return this.context[0]._get('pageIndex');
			}
			else {
				return Promise.all(this.context.map(function (element) {
					return element._get('pageIndex');
				}));
			}
		});
	},
	uploadFile: function () {
		warn(
			'Command#uploadFile',
			'Command#type to type a file path into a file upload form control',
			'This command is not part of any specification. This command is a no-op.'
		);

		return this;
	},
	sauceJobUpdate: function () {
		warn(
			'Command#sauceJobUpdate',
			null,
			'This command is not part of any specification. This command is a no-op.'
		);

		return this;
	},
	sauceJobStatus: function () {
		warn(
			'Command#sauceJobStatus',
			null,
			'This command is not part of any specification. This command is a no-op.'
		);

		return this;
	},
	waitForElement: function () {
		warn(
			'Command#waitForElement',
			'Command#setImplicitWaitTimeout and Command#getElement',
			'This command is implemented using implicit timeouts, which may not match the prior behaviour.'
		);
		return waitForElement.apply(this, arguments);
	},
	waitForVisible: function () {
		warn(
			'Command#waitForVisible',
			null,
			'This command is partially implemented using implicit timeouts, which may not match the prior ' +
			'behaviour.'
		);
		return waitForVisible.apply(this, arguments);
	},
	isVisible: function () {
		warn(
			'Command#isVisible',
			'Command#isDisplayed',
			'This command is implemented using Command#isDisplayed, which may not match the prior behaviour.'
		);

		if (arguments.length === 2) {
			var using = arguments[0];
			var value = arguments[1];
			return this.getElement(using, value).isDisplayed().otherwise(function () {
				return false;
			});
		}
		else if (arguments.length === 1) {
			var element = arguments[0];
			if (element && element.elementId) {
				return new Command(this, function () {
					return element.isDisplayed();
				});
			}
		}

		return new Command(this, function () {
			if (this.context.isSingle) {
				return this.context[0].isDisplayed();
			}
			else {
				return Promise.all(this.context.map(function (element) {
					return element.isDisplayed();
				}));
			}
		});
	}
};

// TODO: type -> typeElement

strategies.suffixes.forEach(function (suffix, index) {
	function addStrategy(method, toMethod, suffix, wdSuffix, using) {
		methods[method + 'OrNull'] = function (value) {
			warn('Command#' + method + 'OrNull', 'Command#' + toMethod +
				' and Command#always, or Command#elementsBy' + suffix);
			return elementOrNull.call(this, using, value);
		};

		methods[method + 'IfExists'] = function (value) {
			warn('Command#' + method + 'IfExists', 'Command#' + toMethod +
				' and Command#always, or Command#elementsBy' + suffix);
			return elementIfExists.call(this, using, value);
		};

		methods['hasElementBy' + wdSuffix] = function (value) {
			warn('Command#hasElementBy' + wdSuffix, 'Command#' + toMethod +
				' and Command#then(exists, doesNotExist)');
			return hasElement.call(this, using, value);
		};

		method['waitForElement' + wdSuffix] = function (value, timeout) {
			warn(
				'Command#waitForElement' + wdSuffix,
				'Command#setImplicitWaitTimeout and Command#' + toMethod,
				'This command is implemented using implicit timeouts, which may not match the prior behaviour.'
			);
			return waitForElement.call(this, using, value, timeout);
		};

		method['waitForVisible' + wdSuffix] = function (value, timeout) {
			warn(
				'Command#waitForVisible' + wdSuffix,
				null,
				'This command is partially implemented using implicit timeouts, which may not match the prior ' +
				'behaviour.'
			);
			return waitForVisible.call(this, using, value, timeout);
		};
	}

	var wdSuffix = suffix === 'XPath' ? 'XPath' : suffix;
	var method = 'elementBy' + wdSuffix;
	var toMethod = 'getElementBy' + suffix;
	var using = strategies[index];
	addStrategy(method, toMethod, suffix, wdSuffix, using);
	if (suffix === 'CssSelector') {
		addStrategy('elementByCss', toMethod, suffix, 'Css', using);
	}
});

module.exports = {
	applyTo: function (prototype) {
		for (var key in methods) {
			Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(methods, key));
		}
	}
};
