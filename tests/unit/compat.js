define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!dojo/Promise',
	'intern/dojo/node!../../Session',
	'intern/dojo/node!../../Command',
	'intern/dojo/node!../../compat',
	'intern/dojo/node!dojo/topic'
], function (registerSuite, assert, Promise, Session, Command, compat, topic) {
	function assertWarn() {
		for (var i = 0, j = arguments.length; i < j; ++i) {
			arguments[i] && assert.include(lastNotice[i], arguments[i]);
		}
	}

	function deprecate(method, replacement) {
		var originalMethod;

		return {
			setup: function () {
				originalMethod = command[replacement];
				command[replacement] = function () {
					var args = Array.prototype.slice.call(arguments, 0);
					return new Command(this, function () {
						return Promise.resolve(args);
					});
				};
			},
			teardown: function () {
				command[replacement] = originalMethod;
			},
			'deprecate': function () {
				return command[method]('a', 'b').then(function (value) {
					assert.deepEqual(value, [ 'a', 'b' ], 'Replacement method should be invoked with same arguments');
					assertWarn('Command#' + method, 'Command#' + replacement);
				});
			}
		};
	}

	function deprecateElementSig(fromMethod, toMethod) {
		var originalMethod;

		var element = {
			elementId: 'test',
		};
		element[toMethod || fromMethod] = function () {
			return Promise.resolve(Array.prototype.slice.call(arguments, 0));
		};

		return {
			setup: function () {
				originalMethod = Command.prototype[fromMethod];
				Command.prototype[fromMethod] = function () {
					var args = Array.prototype.slice.call(arguments, 0);
					return new Command(this, function () {
						return Promise.resolve(args);
					});
				};
			},
			teardown: function () {
				Command.prototype[fromMethod] = originalMethod;
			},
			'deprecateElementSig': function () {
				return command[fromMethod]('a', 'b').then(function (value) {
					assert.deepEqual(value, [ 'a', 'b' ], 'Unmodified method should be invoked with same arguments');
					assert.isNull(lastNotice);
					return command[fromMethod](element, 'c', 'd');
				}).then(function (value) {
					assert.deepEqual(value, [ 'c', 'd' ]);
					assertWarn('Command#' + fromMethod + '(element)', 'Command#getElement then Command#' + fromMethod);
					assertWarn('Command#' + fromMethod + '(element)', 'element.' + (toMethod || fromMethod));
				});
			}
		};
	}

	function deprecateElementAndStandardSig(method, replacement) {
		return function () {
			throw new Error('TODO ' + method + ' ' + replacement);
		};
	}

	var command;
	var handle;
	var lastNotice;
	var capabilities = {};

/*
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
*/

	registerSuite({
		name: 'leadfoot/compat',

		setup: function () {
			command = new Command(new Session('test', {
				getStatus: function () {
					return Promise.resolve('hapy');
				},
				getSessions: function () {
					return Promise.resolve('many things');
				},
				_get: function () {},
				_post: function () {},
				_delete: function () {}
			}, capabilities));

			compat.applyTo(command);

			handle = topic.subscribe('/deprecated', function () {
				lastNotice = arguments;
			});
		},

		beforeEach: function () {
			lastNotice = null;
		},

		teardown: function () {
			handle.remove();
			lastNotice = command = handle = null;
		},

		'assertion sanity check': function () {
			assert.throws(function () {
				assertWarn('a');
			});
		},

		'#sessionID': function () {
			assert.strictEqual(command.sessionID, command.session.sessionId);
			assertWarn('Command#sessionID', 'Command#session.sessionId');
		},

		'#status': function () {
			return command.status().then(function (value) {
				assert.strictEqual(value, 'hapy');
				assertWarn('Command#status');
			});
		},

		'#init': function () {
			assert.strictEqual(command.init(), command);
			assertWarn('Command#init');
		},

		'#sessions': function () {
			return command.sessions().then(function (value) {
				assert.strictEqual(value, 'many things');
				assertWarn('Command#sessions');
			});
		},

		'#sessionCapabilities': function () {
			return command.sessionCapabilities().then(function (capabilities) {
				assert.strictEqual(capabilities, command.session.capabilities);
				assertWarn('Command#sessionCapabilities', 'Command#session.capabilities');
			});
		},

		'#altSessionCapabilities': function () {
			return command.altSessionCapabilities().then(function (capabilities) {
				assert.strictEqual(capabilities, command.session.capabilities);
				assertWarn('Command#altSessionCapabilities', 'Command#session.capabilities');
			});
		},

		'#getSessionId': function () {
			return command.getSessionId().then(function (sessionId) {
				assert.strictEqual(sessionId, command.session.sessionId);
				assertWarn('Command#getSessionId', 'Command#session.sessionId');
			});
		},

		'#getSessionID': function () {
			return command.getSessionID().then(function (sessionId) {
				assert.strictEqual(sessionId, command.session.sessionId);
				assertWarn('Command#getSessionID', 'Command#session.sessionId');
			});
		},

		'#setAsyncScriptTimeout': deprecate('setAsyncScriptTimeout', 'setExecuteAsyncTimeout'),
		'#setWaitTimeout': deprecate('setWaitTimeout', 'setImplicitTimeout'),
		'#setImplicitWaitTimeout': deprecate('setImplicitWaitTimeout', 'setImplicitTimeout'),
		'#windowHandle': deprecate('windowHandle', 'getCurrentWindowHandle'),
		'#windowHandles': deprecate('windowHandles', 'getAllWindowHandles'),
		'#url': deprecate('url', 'getCurrentUrl'),
		'#forward': deprecate('forward', 'goForward'),
		'#back': deprecate('back', 'goBack'),
		'#safeExecute': deprecate('safeExecute', 'execute'),
		'#eval': function () {
			throw new Error('TODO');
		},
		safeEval: function () {
			throw new Error('TODO');
		},
		'#safeExecuteAsync': deprecate('safeExecuteAsync', 'executeAsync'),
		'#frame': deprecate('frame', 'switchToFrame'),
		'#window': deprecate('window', 'switchToWindow'),
		'#close': deprecate('close', 'closeCurrentWindow'),
		'#windowSize': deprecate('windowSize', 'setWindowSize'),
		'#setWindowSize': function () {
			throw new Error('TODO');
		},
		'#setWindowPosition': function () {
			throw new Error('TODO');
		},
		'#maximize': deprecate('maximize', 'maximizeWindow'),
		'#allCookies': deprecate('allCookies', 'getCookies'),
		'#deleteAllCookies': deprecate('deleteAllCookies', 'clearCookies'),
		'#source': deprecate('source', 'getPageSource'),
		'#title': deprecate('title', 'getPageTitle'),
		'#element': deprecate('element', 'getElement'),
		'#elementByClassName': deprecate('elementByClassName', 'getElementByClassName'),
		'#elementByCssSelector': deprecate('elementByCssSelector', 'getElementByCssSelector'),
		'#elementById': deprecate('elementById', 'getElementById'),
		'#elementByName': deprecate('elementByName', 'getElementByName'),
		'#elementByLinkText': deprecate('elementByLinkText', 'getElementByLinkText'),
		'#elementByPartialLinkText': deprecate('elementByPartialLinkText', 'getElementByPartialLinkText'),
		'#elementByTagName': deprecate('elementByTagName', 'getElementByTagName'),
		'#elementByXPath': deprecate('elementByXPath', 'getElementByXpath'),
		'#elementByCss': deprecate('elementByCss', 'getElementByCssSelector'),
		'#elements': deprecate('elements', 'getElements'),
		'#elementsByClassName': deprecate('elementsByClassName', 'getElementsByClassName'),
		'#elementsByCssSelector': deprecate('elementsByCssSelector', 'getElementsByCssSelector'),
		'#elementsById': function () {
			throw new Error('TODO');
		},
		'#elementsByName': deprecate('elementsByName', 'getElementsByName'),
		'#elementsByLinkText': deprecate('elementsByLinkText', 'getElementsByLinkText'),
		'#elementsByPartialLinkText': deprecate('elementsByPartialLinkText', 'getElementsByPartialLinkText'),
		'#elementsByTagName': deprecate('elementsByTagName', 'getElementsByTagName'),
		'#elementsByXPath': deprecate('elementsByXPath', 'getElementsByXpath'),
		'#elementsByCss': deprecate('elementsByCss', 'getElementsByCssSelector'),
		'#elementOrNull': function () {
			throw new Error('TODO');
		},
		'#elementIfExists': function () {
			throw new Error('TODO');
		},
		'#hasElement': function () {
			throw new Error('TODO');
		},
		'#active': deprecate('active', 'getActiveElement'),
		'#clickElement': deprecateElementSig('clickElement', 'click'),
		'#submit': deprecateElementSig('submit'),
		'#text': deprecateElementAndStandardSig('text', 'getVisibleText'),

		'#textPresent': function () {
			throw new Error('TODO');
		},

		// This is not backwards-compatible because it is impossible to know whether someone is expecting this to
		// work like the old element `type` because they have not converted their code yet, or like the new session
		// `type` because they have
		'#type': deprecateElementSig('type', 'type'),

		'#keys': deprecate('keys', 'type'),
		'#getTagName': deprecateElementSig('getTagName'),
		'#clear': deprecateElementAndStandardSig('clear', 'clearValue'),
		'#isSelected': deprecateElementSig('isSelected'),
		'#isEnabled': deprecateElementSig('isEnabled'),
		'#enabled': deprecateElementAndStandardSig('enabled', 'isEnabled'),
		'#getAttribute': deprecateElementSig('getAttribute'),
		'#getValue': function () {
			throw new Error('TODO');
		},
		'#equalsElement': function () {
			throw new Error('TODO');
		},
		'#isDisplayed': deprecateElementSig('isDisplayed'),
		'#displayed': deprecateElementAndStandardSig('displayed', 'isDisplayed'),
		'#getLocation': deprecateElementAndStandardSig('getLocation', 'getPosition'),
		'#getLocationInView': function () {
			throw new Error('TODO');
		},
		'#getSize': deprecateElementSig('getSize'),
		'#getComputedCss': deprecateElementAndStandardSig('getComputedCss', 'getComputedStyle'),
		'#getComputedCSS': deprecateElementAndStandardSig('getComputedCSS', 'getComputedStyle'),
		'#alertText': deprecate('alertText', 'getAlertText'),
		'#alertKeys': deprecate('alertKeys', 'typeInPrompt'),
		'#moveTo': deprecateElementAndStandardSig('moveTo', 'moveMouseTo'),
		'#click': deprecateElementSig('click'),
		'#buttonDown': deprecate('buttonDown', 'pressMouseButton'),
		'#buttonUp': deprecate('buttonUp', 'releaseMouseButton'),
		'#doubleclick': deprecate('doubleclick', 'doubleClick'),
		'#tapElement': deprecateElementSig('tapElement', 'tap'),
		'#flick': deprecate('flick', 'flickFinger'),
		'#setLocalStorageKey': deprecate('setLocalStorageKey', 'setLocalStorageItem'),
		'#getLocalStorageKey': deprecate('getLocalStorageKey', 'getLocalStorageItem'),
		'#removeLocalStorageKey': deprecate('removeLocalStorageKey', 'deleteLocalStorageItem'),
		'#log': deprecate('log', 'getLogsFor'),
		'#logTypes': deprecate('logTypes', 'getAvailableLogTypes'),
		'#newWindow': function () {
			throw new Error('TODO');
		},
		'#windowName': function () {
			throw new Error('TODO');
		},
		'#setHTTPInactivityTimeout': function () {
			throw new Error('TODO');
		},
		'#getPageIndex': function () {
			throw new Error('TODO');
		},
		'#uploadFile': function () {
			assert.strictEqual(command.uploadFile(), command);
			assertWarn('Command#uploadFile', 'Command#type');
		},
		sauceJobUpdate: function () {
			assert.strictEqual(command.sauceJobUpdate(), command);
			assertWarn('Command#sauceJobUpdate');
		},
		sauceJobStatus: function () {
			assert.strictEqual(command.sauceJobStatus(), command);
			assertWarn('Command#sauceJobStatus');
		},
		waitForElement: function () {
			throw new Error('TODO');
		},
		waitForVisible: function () {
			throw new Error('TODO');
		},
		isVisible: function () {
			throw new Error('TODO');
		}
	});
});
