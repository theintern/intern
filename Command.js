/**
 * @module leadfoot/Command
 */

var Element = require('./Element');
var Promise = require('dojo/Promise');
var strategies = require('./strategies');
var Session = require('./Session');
var util = require('./util');

/**
 * Creates a function that, when called, creates a new Command that retrieves elements from the parent context and
 * uses them as the context for the newly created Command.
 *
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
					// getElements against an array context will result in arrays of arrays; flatten into a single
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

	function aborter() {
		throw new Error('Cancelled');
	}

	/* jshint maxlen:130 */
	this._promise = (parent ? parent.promise : util.createPromise(undefined, aborter)).then(function (returnValue) {
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

Command.prototype = /** @lends module:leadfoot/Command# */ {
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
	 * Cancels all outstanding chained operations of the Command. Calling this method will cause all chained
	 * operations to fail with an AbortError.
	 *
	 * @returns {module:leadfoot/Command.<void>}
	 */
	cancel: function () {
		this._promise.abort.apply(this._promise, arguments);
		return this;
	},

	getElement: createElementMethod('getElement'),
	getElements: createElementMethod('getElements')
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
// getElement/getElements methods that operate based on the Command’s context, so can’t simply be delegated to the
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
