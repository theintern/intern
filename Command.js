/**
 * @module leadfoot/Command
 */

var Element = require('./Element');
var Promise = require('dojo/Promise');
var strategies = require('./lib/strategies');
var Session = require('./Session');
var util = require('./lib/util');

/**
 * Creates a function that, when called, creates a new Command that retrieves elements from the parent context and
 * uses them as the context for the newly created Command.
 *
 * @private
 * @param {string} method
 * @returns {Function}
 */
function createElementMethod(method) {
	return function () {
		var args = arguments;
		return new Command(this, function (setContext) {
			var parentContext = this._context;
			var promise;

			if (parentContext.length && parentContext.isSingle) {
				promise = parentContext[0][method].apply(parentContext[0], args);
			}
			else if (parentContext.length) {
				promise = Promise.all(parentContext.map(function (element) {
					return element[method].apply(element, args);
				})).then(function (elements) {
					// findAll against an array context will result in arrays of arrays; flatten into a single
					// array of elements. It would also be possible to resort in document order but other parallel
					// operations could not be sorted so we just don't do it anywhere and say not to rely in
					// a particular return order for results
					return Array.prototype.concat.apply([], elements);
				});
			}
			else {
				promise = this.session[method].apply(this.session, args);
			}

			return promise.then(function (newContext) {
				setContext(newContext);
				return newContext;
			});
		});
	};
}

/**
 * A Command is a chainable object that can be used to execute commands serially against a remote environment using
 * a fluid interface.
 *
 * @constructor module:leadfoot/Command
 * @param {module:leadfoot/Command|module:leadfoot/Session} parent
 * The parent command that this command is chained to, or a {@link module:leadfoot/Session} object if this is the
 * first command in a command chain.
 *
 * @param {function(setContext:Function, value:any): (any|Promise)} initialiser
 * A function that will be executed when all parent commands have completed execution. This function can create a
 * new context for this command by calling the passed `setContext` function any time prior to resolving the Promise
 * that it returns. If no context is explicitly provided, the context from the parent command will be used.
 *
 * @param {(function(setContext:Function, error:Error): (any|Promise))=} errback
 * A function that will be executed if any parent commands failed to complete successfully. This function can create
 * a new context for the current command by calling the passed `setContext` function any time prior to resolving the
 * Promise that it returns. If no context is explicitly provided, the context from the parent command will be used.
 *
 * @borrows module:leadfoot/Session#getTimeout as module:leadfoot/Command#getTimeout
 * @borrows module:leadfoot/Session#setTimeout as module:leadfoot/Command#setTimeout
 * @borrows module:leadfoot/Session#getCurrentWindowHandle as module:leadfoot/Command#getCurrentWindowHandle
 * @borrows module:leadfoot/Session#getAllWindowHandles as module:leadfoot/Command#getAllWindowHandles
 * @borrows module:leadfoot/Session#getCurrentUrl as module:leadfoot/Command#getCurrentUrl
 * @borrows module:leadfoot/Session#get as module:leadfoot/Command#get
 * @borrows module:leadfoot/Session#goForward as module:leadfoot/Command#goForward
 * @borrows module:leadfoot/Session#goBack as module:leadfoot/Command#goBack
 * @borrows module:leadfoot/Session#refresh as module:leadfoot/Command#refresh
 * @borrows module:leadfoot/Session#execute as module:leadfoot/Command#execute
 * @borrows module:leadfoot/Session#executeAsync as module:leadfoot/Command#executeAsync
 * @borrows module:leadfoot/Session#takeScreenshot as module:leadfoot/Command#takeScreenshot
 * @borrows module:leadfoot/Session#getAvailableImeEngines as module:leadfoot/Command#getAvailableImeEngines
 * @borrows module:leadfoot/Session#getActiveImeEngine as module:leadfoot/Command#getActiveImeEngine
 * @borrows module:leadfoot/Session#isImeActivated as module:leadfoot/Command#isImeActivated
 * @borrows module:leadfoot/Session#deactivateIme as module:leadfoot/Command#deactivateIme
 * @borrows module:leadfoot/Session#activateIme as module:leadfoot/Command#activateIme
 * @borrows module:leadfoot/Session#switchToFrame as module:leadfoot/Command#switchToFrame
 * @borrows module:leadfoot/Session#switchToWindow as module:leadfoot/Command#switchToWindow
 * @borrows module:leadfoot/Session#switchToParentFrame as module:leadfoot/Command#switchToParentFrame
 * @borrows module:leadfoot/Session#closeCurrentWindow as module:leadfoot/Command#closeCurrentWindow
 * @borrows module:leadfoot/Session#setWindowSize as module:leadfoot/Command#setWindowSize
 * @borrows module:leadfoot/Session#getWindowSize as module:leadfoot/Command#getWindowSize
 * @borrows module:leadfoot/Session#setWindowPosition as module:leadfoot/Command#setWindowPosition
 * @borrows module:leadfoot/Session#getWindowPosition as module:leadfoot/Command#getWindowPosition
 * @borrows module:leadfoot/Session#maximizeWindow as module:leadfoot/Command#maximizeWindow
 * @borrows module:leadfoot/Session#getCookies as module:leadfoot/Command#getCookies
 * @borrows module:leadfoot/Session#setCookie as module:leadfoot/Command#setCookie
 * @borrows module:leadfoot/Session#clearCookies as module:leadfoot/Command#clearCookies
 * @borrows module:leadfoot/Session#deleteCookie as module:leadfoot/Command#deleteCookie
 * @borrows module:leadfoot/Session#getPageSource as module:leadfoot/Command#getPageSource
 * @borrows module:leadfoot/Session#getPageTitle as module:leadfoot/Command#getPageTitle
 * @borrows module:leadfoot/Session#find as module:leadfoot/Command#find
 * @borrows module:leadfoot/Session#findAll as module:leadfoot/Command#findAll
 * @borrows module:leadfoot/Session#getActiveElement as module:leadfoot/Command#getActiveElement
 * @borrows module:leadfoot/Session#type as module:leadfoot/Command#type
 * @borrows module:leadfoot/Session#getOrientation as module:leadfoot/Command#getOrientation
 * @borrows module:leadfoot/Session#setOrientation as module:leadfoot/Command#setOrientation
 * @borrows module:leadfoot/Session#getAlertText as module:leadfoot/Command#getAlertText
 * @borrows module:leadfoot/Session#typeInPrompt as module:leadfoot/Command#typeInPrompt
 * @borrows module:leadfoot/Session#acceptAlert as module:leadfoot/Command#acceptAlert
 * @borrows module:leadfoot/Session#dismissAlert as module:leadfoot/Command#dismissAlert
 * @borrows module:leadfoot/Session#moveMouseTo as module:leadfoot/Command#moveMouseTo
 * @borrows module:leadfoot/Session#click as module:leadfoot/Command#click
 * @borrows module:leadfoot/Session#pressMouseButton as module:leadfoot/Command#pressMouseButton
 * @borrows module:leadfoot/Session#releaseMouseButton as module:leadfoot/Command#releaseMouseButton
 * @borrows module:leadfoot/Session#doubleClick as module:leadfoot/Command#doubleClick
 * @borrows module:leadfoot/Session#tap as module:leadfoot/Command#tap
 * @borrows module:leadfoot/Session#pressFinger as module:leadfoot/Command#pressFinger
 * @borrows module:leadfoot/Session#releaseFinger as module:leadfoot/Command#releaseFinger
 * @borrows module:leadfoot/Session#moveFinger as module:leadfoot/Command#moveFinger
 * @borrows module:leadfoot/Session#touchScroll as module:leadfoot/Command#touchScroll
 * @borrows module:leadfoot/Session#doubleTap as module:leadfoot/Command#doubleTap
 * @borrows module:leadfoot/Session#longTap as module:leadfoot/Command#longTap
 * @borrows module:leadfoot/Session#flickFinger as module:leadfoot/Command#flickFinger
 * @borrows module:leadfoot/Session#getGeolocation as module:leadfoot/Command#getGeolocation
 * @borrows module:leadfoot/Session#setGeolocation as module:leadfoot/Command#setGeolocation
 * @borrows module:leadfoot/Session#getLogsFor as module:leadfoot/Command#getLogsFor
 * @borrows module:leadfoot/Session#getAvailableLogTimes as module:leadfoot/Command#getAvailableLogTimes
 * @borrows module:leadfoot/Session#getApplicationCacheStatus as module:leadfoot/Command#getApplicationCacheStatus
 * @borrows module:leadfoot/Session#quit as module:leadfoot/Command#quit
 * @borrows module:leadfoot/Session#getLocalStorageKeys as module:leadfoot/Command#getLocalStorageKeys
 * @borrows module:leadfoot/Session#setLocalStorageItem as module:leadfoot/Command#setLocalStorageItem
 * @borrows module:leadfoot/Session#clearLocalStorage as module:leadfoot/Command#clearLocalStorage
 * @borrows module:leadfoot/Session#getLocalStorageItem as module:leadfoot/Command#getLocalStorageItem
 * @borrows module:leadfoot/Session#deleteLocalStorageItem as module:leadfoot/Command#deleteLocalStorageItem
 * @borrows module:leadfoot/Session#getLocalStorageLength as module:leadfoot/Command#getLocalStorageLength
 * @borrows module:leadfoot/Session#getSessionStorageKeys as module:leadfoot/Command#getSessionStorageKeys
 * @borrows module:leadfoot/Session#setSessionStorageItem as module:leadfoot/Command#setSessionStorageItem
 * @borrows module:leadfoot/Session#clearSessionStorage as module:leadfoot/Command#clearSessionStorage
 * @borrows module:leadfoot/Session#getSessionStorageItem as module:leadfoot/Command#getSessionStorageItem
 * @borrows module:leadfoot/Session#deleteSessionStorageItem as module:leadfoot/Command#deleteSessionStorageItem
 * @borrows module:leadfoot/Session#getSessionStorageLength as module:leadfoot/Command#getSessionStorageLength
 * @borrows module:leadfoot/Session#findByClassName as module:leadfoot/Command#findByClassName
 * @borrows module:leadfoot/Session#findByCssSelector as module:leadfoot/Command#findByCssSelector
 * @borrows module:leadfoot/Session#findById as module:leadfoot/Command#findById
 * @borrows module:leadfoot/Session#findByName as module:leadfoot/Command#findByName
 * @borrows module:leadfoot/Session#findByLinkText as module:leadfoot/Command#findByLinkText
 * @borrows module:leadfoot/Session#findByPartialLinkText as module:leadfoot/Command#findByPartialLinkText
 * @borrows module:leadfoot/Session#findByTagName as module:leadfoot/Command#findByTagName
 * @borrows module:leadfoot/Session#findByXpath as module:leadfoot/Command#findByXpath
 * @borrows module:leadfoot/Session#findAllByClassName as module:leadfoot/Command#findAllByClassName
 * @borrows module:leadfoot/Session#findAllByCssSelector as module:leadfoot/Command#findAllByCssSelector
 * @borrows module:leadfoot/Session#findAllByName as module:leadfoot/Command#findAllByName
 * @borrows module:leadfoot/Session#findAllByLinkText as module:leadfoot/Command#findAllByLinkText
 * @borrows module:leadfoot/Session#findAllByPartialLinkText as module:leadfoot/Command#findAllByPartialLinkText
 * @borrows module:leadfoot/Session#findAllByTagName as module:leadfoot/Command#findAllByTagName
 * @borrows module:leadfoot/Session#findAllByXpath as module:leadfoot/Command#findAllByXpath
 * @borrows module:leadfoot/Session#waitForDeletedByClassName as module:leadfoot/Command#waitForDeletedByClassName
 * @borrows module:leadfoot/Session#waitForDeletedByCssSelector as module:leadfoot/Command#waitForDeletedByCssSelector
 * @borrows module:leadfoot/Session#waitForDeletedById as module:leadfoot/Command#waitForDeletedById
 * @borrows module:leadfoot/Session#waitForDeletedByName as module:leadfoot/Command#waitForDeletedByName
 * @borrows module:leadfoot/Session#waitForDeletedByLinkText as module:leadfoot/Command#waitForDeletedByLinkText
 * @borrows module:leadfoot/Session#waitForDeletedByPartialLinkText as module:leadfoot/Command#waitForDeletedByPartialLinkText
 * @borrows module:leadfoot/Session#waitForDeletedByTagName as module:leadfoot/Command#waitForDeletedByTagName
 * @borrows module:leadfoot/Session#waitForDeletedByXpath as module:leadfoot/Command#waitForDeletedByXpath
 * @borrows module:leadfoot/Session#getExecuteAsyncTimeout as module:leadfoot/Command#getExecuteAsyncTimeout
 * @borrows module:leadfoot/Session#setExecuteAsyncTimeout as module:leadfoot/Command#setExecuteAsyncTimeout
 * @borrows module:leadfoot/Session#getFindTimeout as module:leadfoot/Command#getFindTimeout
 * @borrows module:leadfoot/Session#setFindTimeout as module:leadfoot/Command#setFindTimeout
 * @borrows module:leadfoot/Session#getPageLoadTimeout as module:leadfoot/Command#getPageLoadTimeout
 * @borrows module:leadfoot/Session#setPageLoadTimeout as module:leadfoot/Command#setPageLoadTimeout
 * @borrows module:leadfoot/Element#click as module:leadfoot/Command#clickElement
 * @borrows module:leadfoot/Element#submit as module:leadfoot/Command#submit
 * @borrows module:leadfoot/Element#getVisibleText as module:leadfoot/Command#getVisibleText
 * @borrows module:leadfoot/Element#type as module:leadfoot/Command#typeElement
 * @borrows module:leadfoot/Element#getTagName as module:leadfoot/Command#getTagName
 * @borrows module:leadfoot/Element#clearValue as module:leadfoot/Command#clearValue
 * @borrows module:leadfoot/Element#isSelected as module:leadfoot/Command#isSelected
 * @borrows module:leadfoot/Element#isEnabled as module:leadfoot/Command#isEnabled
 * @borrows module:leadfoot/Element#getAttribute as module:leadfoot/Command#getAttribute
 * @borrows module:leadfoot/Element#equals as module:leadfoot/Command#equals
 * @borrows module:leadfoot/Element#isDisplayed as module:leadfoot/Command#isDisplayed
 * @borrows module:leadfoot/Element#getPosition as module:leadfoot/Command#getPosition
 * @borrows module:leadfoot/Element#getSize as module:leadfoot/Command#getSize
 * @borrows module:leadfoot/Element#getComputedStyle as module:leadfoot/Command#getComputedStyle
 */
function Command(parent, initialiser, errback) {
	var self = this;
	var session;

	function setContext(context) {
		if (!Array.isArray(context)) {
			context = [ context ];
			context.isSingle = true;
		}

		self._context = context;
	}

	if (parent && parent.session) {
		this._parent = parent;
		session = this._session = parent.session;
	}
	else if (parent && parent.sessionId) {
		session = this._session = parent;
		parent = null;
	}
	else {
		throw new Error('A parent Command or Session must be provided to a new Command');
	}

	// Add any custom functions from the session to this command object so they can be accessed automatically
	// using the fluid interfaces
	// TODO: Test
	for (var key in session) {
		if (session[key] !== Session.prototype[key]) {
			Command.addSessionMethod(this, key, session[key]);
		}
	}

	Error.captureStackTrace(this, Command);

	/* jshint maxlen:130 */
	this._promise = (parent ? parent.promise : Promise.resolve(undefined)).then(function (returnValue) {
		self._context = parent ? parent.context : [];
		return returnValue;
	}).then(
		initialiser && initialiser.bind(this, setContext),
		errback && errback.bind(this, setContext)
	).catch(function (error) {
		// The first line of a stack trace from V8 is the string representation of the object holding the stack
		// trace; in this case, the Command object holds the stack trace, and has no string representation, so we
		// remove it from the output
		error.stack = error.stack + self.stack.replace(/^[^\n]+/, '');
		throw error;
	});
}

/**
 * @lends module:leadfoot/Command#
 */
Command.prototype = {
	constructor: Command,

	/**
	 * The parent Command of the command, if one exists.
	 *
	 * @member {module:leadfoot/Command=} parent
	 * @memberOf module:leadfoot/Command#
	 * @readonly
	 */
	get parent() {
		return this._parent;
	},

	/**
	 * The parent Session of the command.
	 *
	 * @member {module:leadfoot/Session} session
	 * @memberOf module:leadfoot/Command#
	 * @readonly
	 */
	get session() {
		return this._session;
	},

	get context() {
		return this._context;
	},

	get promise() {
		return this._promise;
	},

	/**
	 * Pauses execution of the next command in the chain for `ms` milliseconds.
	 *
	 * @param {number} ms Time to delay, in milliseconds.
	 * @returns {module:leadfoot/Command.<void>}
	 */
	sleep: function (ms) {
		return new Command(this, function () {
			return util.sleep(ms);
		});
	},

	/**
	 * Ends the most recent filtering operation in the current Command chain and returns the most recent Command
	 * with a different element match state.
	 *
	 * @param {number=} numCommandsToPop The number of element contexts to pop. Defaults to 1.
	 * @returns {module:leadfoot/Command.<void>}
	 */
	end: function (numCommandsToPop) {
		numCommandsToPop = numCommandsToPop || 1;

		return new Command(this, function (setContext) {
			var command = this;

			while (numCommandsToPop && command.parent) {
				if (command.context !== command.parent.context) {
					--numCommandsToPop;
				}

				command = command.parent;
			}

			setContext(command.context);
		});
	},

	/**
	 * Adds a callback to be invoked once the previously chained operation has completed. Command callbacks
	 * receive a second non-standard argument, `setContext`, which allows callbacks to create new contexts for
	 * subsequent chained commands.
	 *
	 * @param {Function=} callback
	 * @param {Function=} errback
	 * @returns {module:leadfoot/Command.<any>}
	 */
	then: function (callback, errback) {
		return new Command(this, callback && function (setContext, value) {
			return callback.call(this, value, setContext);
		}, errback && function (setContext, value) {
			return errback.call(this, value, setContext);
		});
	},

	/**
	 * Adds a callback to be invoked when any of the previously chained operations have failed.
	 *
	 * @param {Function} errback
	 * @returns {module:leadfoot/Command.<any>}
	 */
	otherwise: function (errback) {
		return this.then(null, errback);
	},

	/**
	 * Adds a callback to be invoked once the previously chained operations have resolved.
	 *
	 * @param {Function} callback
	 * @returns {module:leadfoot/Command.<any>}
	 */
	always: function (callback) {
		return this.then(callback, callback);
	},

	/**
	 * Cancels all outstanding chained operations of the Command. Calling this method will cause this command and all
	 * subsequent chained commands to fail with a CancelError.
	 *
	 * @returns {module:leadfoot/Command.<void>}
	 */
	cancel: function () {
		this._promise.cancel.apply(this._promise, arguments);
		return this;
	},

	find: createElementMethod('find'),
	findAll: createElementMethod('findAll')
};

/**
 * Augments `target` with a conversion of the `originalFn` method that enables its use with a Command object.
 * This can be used to easily add new methods from any custom object that implements the Session API to any target
 * object that implements the Command API.
 *
 * Functions that are copied may have the following extra properties in order to change the way that Command works
 * with these functions:
 *
 * - `createsContext` (boolean): If this property is specified, the return value from the function will be used as
 *   the new context for the returned Command.
 * - `usesElement` (boolean): If this property is specified, element(s) from the current context will be used as
 *   the first argument to the function, if the explicitly specified first argument is not already an element.
 *
 * @memberOf module:leadfoot/Command
 * @param {module:leadfoot/Command} target
 * @param {string} key
 * @param {Function} originalFn
 */
Command.addSessionMethod = function (target, key, originalFn) {
	// Checking for private/non-functions here deduplicates this logic; otherwise it would need to exist in both
	// the Command constructor (for copying functions from sessions) as well as the Command factory below
	if (key.charAt(0) !== '_' && !target[key] && typeof originalFn === 'function') {
		target[key] = function () {
			var args = arguments;

			return new Command(this, function (setContext) {
				var parentContext = this._context;
				var session = this._session;
				// The function may have come from a session object prototype but have been overridden on the actual
				// session instance; in such a case, the overridden function should be used instead of the one from
				// the original source object. The original source object may still be used, however, if the
				// function is being added like a mixin and does not exist on the actual session object for this
				// session
				var fn = session[key] || originalFn;

				if (fn.usesElement && parentContext.length && (!args[0] || !args[0].elementId)) {
					var promise;
					// Defer converting arguments into an array until it is necessary to avoid overhead
					args = Array.prototype.slice.call(args, 0);

					if (parentContext.isSingle) {
						promise = fn.apply(session, [ parentContext[0] ].concat(args));
					}
					else {
						promise = Promise.all(parentContext.map(function (element) {
							return fn.apply(session, [ element ].concat(args));
						}));
					}
				}
				else {
					promise = fn.apply(session, args);
				}

				if (fn.createsContext) {
					promise = promise.then(function (newContext) {
						setContext(newContext);
						return newContext;
					});
				}

				return promise;
			});
		};
	}
};

/**
 * Augments `target` with a method that will call `key` on all context elements stored within `target`.
 * This can be used to easily add new methods from any custom object that implements the Element API to any target
 * object that implements the Command API.
 *
 * Functions that are copied may have the following extra properties in order to change the way that Command works
 * with these functions:
 *
 * - `createsContext` (boolean): If this property is specified, the return value from the function will be used as
 *   the new context for the returned Command.
 *
 * @memberOf module:leadfoot/Command
 * @param {module:leadfoot/Command} target
 * @param {string} key
 */
Command.addElementMethod = function (target, key) {
	if (key.charAt(0) !== '_') {
		// some methods, like `click`, exist on both Session and Element; deduplicate these methods by appending the
		// element ones with 'Element'
		var targetKey = key + (target[key] ? 'Element' : '');
		target[targetKey] = function () {
			var args = arguments;

			return new Command(this, function (setContext) {
				var parentContext = this._context;
				var promise;
				var fn = parentContext[0] && parentContext[0][key];

				if (parentContext.isSingle) {
					promise = fn.apply(parentContext[0], args);
				}
				else {
					promise = Promise.all(parentContext.map(function (element) {
						return element[key].apply(element, args);
					}));
				}

				if (fn && fn.createsContext) {
					promise = promise.then(function (newContext) {
						setContext(newContext);
						return newContext;
					});
				}

				return promise;
			});
		};
	}
};

// Element retrieval strategies must be applied directly to Command because it has its own custom
// find/findAll methods that operate based on the Command’s context, so can’t simply be delegated to the
// underlying session
strategies.applyTo(Command.prototype);

(function () {
	var key;
	for (key in Session.prototype) {
		Command.addSessionMethod(Command.prototype, key, Session.prototype[key]);
	}

	for (key in Element.prototype) {
		Command.addElementMethod(Command.prototype, key);
	}
})();

try {
	var chaiAsPromised = require.nodeRequire('chai-as-promised');
}
catch (error) {}

// TODO: Test
if (chaiAsPromised) {
	chaiAsPromised.transferPromiseness = function (assertion, promise) {
		assertion.then = promise.then.bind(promise);
		Object.keys(Command.prototype).forEach(function (method) {
			if (typeof promise[method] === 'function') {
				assertion[method] = promise[method].bind(promise);
			}
		});
	};
}

module.exports = Command;
