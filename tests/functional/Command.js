/* jshint dojo:true */
define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!dojo/Promise',
	'./support/util',
	'dojo/node!../../strategies',
	'dojo/node!../../Command',
	'require'
], function (registerSuite, assert, Promise, util, strategies, Command, require) {
	/*jshint maxlen:140 */
	registerSuite(function () {
		var session;

		return {
			name: 'Command',
			setup: function () {
				return util.createSessionFromRemote(this.remote).then(function () {
					session = arguments[0];
				});
			},

			beforeEach: function () {
				return session.get('about:blank').then(function () {
					return session.setTimeout('implicit', 0);
				});
			},

			'error handling': {
				'initialiser throws': function () {
					return new Command(session, function () {
						throw new Error('broken');
					}).then(function () {
						throw new Error('Error thrown in initialiser should reject the Command');
					}, function (error) {
						assert.strictEqual(error.message, 'broken');
						assert.include(error.stack, 'tests/functional/Command.js:31:13',
							'Stack trace should point back to the error');
						error.message += ' 2';
						throw error;
					}).then(function () {
						throw new Error('Error thrown in parent Command should reject child Command');
					}, function (error) {
						assert.strictEqual(error.message, 'broken 2');
					});
				},

				'invalid async command': function () {
					var command = new Command(session).sleep(100);
					Command.addSessionMethod(command, 'invalid', function () {
						return new Promise(function (resolve, reject) {
							setTimeout(function () {
								reject(new Error('Invalid call'));
							}, 0);
						});
					});

					return command
						.invalid()
						.then(function () {
							throw new Error('Invalid command should have thrown error');
						}, function (error) {
							assert.strictEqual(error.message, 'Invalid call');
							assert.include(error.stack.slice(0, error.stack.indexOf('\n')), error.message,
								'Original error message should be provided on the first line of the stack trace');
							assert.include(error.stack, 'tests/functional/Command.js:53',
								'Stack trace should point back to the async method call that eventually threw the error');
						});
				}
			},

			'initialisation': function () {
				assert.throws(function () {
					/*jshint nonew:false */
					new Command();
				}, /A parent Command or Session must be provided to a new Command/);

				var dfd = this.async();
				var parent = new Command(session, function (setContext) {
					setContext('foo');
					return util.createPromise('bar');
				});

				var expectedContext = [ 'foo' ];
				expectedContext.isSingle = true;

				var command = parent.then(function (returnValue) {
					var self = this;
					// setTimeout is necessary because underlying Promise implementation resolves same-turn and so
					// `command` is still not defined when this callback executes
					setTimeout(dfd.callback(function () {
						assert.strictEqual(self, command, 'The `this` object in callbacks should be the Command object');
						assert.deepEqual(command.context, expectedContext, 'The context of the Command should be set by the initialiser');
						assert.deepEqual(returnValue, 'bar', 'The return value of the initialiser should be exposed to the first callback');
					}), 0);
				});

				return dfd.promise;
			},

			'basic chaining': function () {
				var command = new Command(session);
				return command.get(require.toUrl('./data/default.html'))
					.getPageTitle()
					.then(function (pageTitle) {
						assert.strictEqual(pageTitle, 'Default & <b>default</b>');
					})
					.get(require.toUrl('./data/form.html'))
					.getPageTitle()
					.then(function (pageTitle) {
						assert.strictEqual(pageTitle, 'Form');
					});
			},

			'child is a separate command': function () {
				var parent = new Command(session).get(require.toUrl('./data/default.html'));
				var child = parent.getElementByTagName('p');

				return child.then(function (element) {
						assert.notStrictEqual(child, parent, 'Getting an element should cause a new Command to be created');
						assert.isObject(element, 'Element should be provided to first callback of new Command');
					}).getTagName()
					.then(function (tagName) {
						assert.strictEqual(tagName, 'p', 'Tag name of context element should be provided');
					});
			},

			'basic form interaction': function () {
				var command = new Command(session);
				return command.get(require.toUrl('./data/form.html'))
					.getElementById('input')
						.clickElement()
						.type('hello')
						.getAttribute('value')
						.then(function (value) {
							assert.strictEqual(value, 'hello', 'Typing into a form field should put data in the field');
						});
			},

			'#getElements': function () {
				return new Command(session).get(require.toUrl('./data/elements.html'))
					.getElementsByClassName('b')
					.getAttribute('id')
					.then(function (ids) {
						assert.deepEqual(ids, [ 'b2', 'b1', 'b3', 'b4' ]);
					});
			},

			'#getElements chain': function () {
				return new Command(session).get(require.toUrl('./data/elements.html'))
					.getElementById('c')
						.getElementsByClassName('b')
							.getAttribute('id')
							.then(function (ids) {
								assert.deepEqual(ids, [ 'b3', 'b4' ]);
							})
							.getElementsByClassName('a')
								.then(function (elements) {
									assert.lengthOf(elements, 0);
								})
						.end(2)
					.end()
					.getElementsByClassName('b')
						.getAttribute('id')
						.then(function (ids) {
							assert.deepEqual(ids, [ 'b2', 'b1', 'b3', 'b4' ]);
						});
			},

			'#getElements + #getElements': function () {
				return new Command(session).get(require.toUrl('./data/elements.html'))
					.getElementsByTagName('div')
						.getElementsByCssSelector('span, a')
							.getAttribute('id')
							.then(function (ids) {
								assert.deepEqual(ids, [ 'f', 'g', 'j', 'i1', 'k', 'zz' ]);
							});
			},

			'#sleep': function () {
				var startTime = Date.now();
				return new Command(session)
					.sleep(2000)
					.then(function () {
						assert.closeTo(Date.now() - startTime, 2000, 200,
							'Sleep should prevent next command from executing for the specified amount of time');
					});
			},

			'#end beyond the top of the command list': function () {
				return new Command(session, function (setContext) { setContext([ 'a' ]); })
					.end(20)
					.then(function () {
						assert.deepEqual(this.context, [ 'a' ], 'Calling #end when there is nowhere else to go should be a no-op');
					});
			},

			'#otherwise': function () {
				var command = new Command(session);
				var callback;
				var errback;
				var expectedErrback = function () {};
				command.then = function () {
					callback = arguments[0];
					errback = arguments[1];
					return 'thenCalled';
				};
				var result = command.otherwise(expectedErrback);
				assert.strictEqual(result, 'thenCalled');
				assert.isNull(callback);
				assert.strictEqual(errback, expectedErrback);
			},

			'#always': function () {
				var command = new Command(session);
				var callback;
				var errback;
				var expected = function () {};
				command.then = function () {
					callback = arguments[0];
					errback = arguments[1];
					return 'thenCalled';
				};
				var result = command.always(expected);
				assert.strictEqual(result, 'thenCalled');
				assert.strictEqual(callback, expected);
				assert.strictEqual(errback, expected);
			},

			'#cancel': function () {
				var command = new Command(session);
				var sleepCommand = command.sleep(5000);
				sleepCommand.cancel();

				return sleepCommand.then(function () {
					throw new Error('Sleep command should have been cancelled');
				}, function (error) {
					assert.strictEqual(error.name, 'CancelError');
				});
			},

			'session createsContext': function () {
				var command = new Command(session, function (setContext) {
					setContext('a');
				});

				Command.addSessionMethod(command, 'newContext', util.forCommand(function () {
					return util.createPromise('b');
				}, { createsContext: true }));

				return command.newContext().then(function () {
					var expected = [ 'b' ];
					expected.isSingle = true;

					assert.deepEqual(this.context, expected,
						'Function that returns a value that has been annotated with createsContext should generate a new context');
				});
			},

			'element createsContext': function () {
				var command = new Command(session, function (setContext) {
					setContext({
						elementId: 'farts',
						newContext: util.forCommand(function () {
							return util.createPromise('b');
						}, { createsContext: true })
					});
				});

				Command.addElementMethod(command, 'newContext');

				return command.newContext().then(function () {
					var expected = [ 'b' ];
					expected.isSingle = true;

					assert.deepEqual(this.context, expected,
						'Function that returns a value that has been annotated with createsContext should generate a new context');
				});
			},

			'session usesElement single': function () {
				var command = new Command(session, function (setContext) {
					setContext('a');
				});

				Command.addSessionMethod(command, 'useElement', util.forCommand(function (context, arg) {
					assert.strictEqual(context, 'a',
						'Context object should be passed as first argument to function annotated with usesElement');
					assert.strictEqual(arg, 'arg1',
						'Arguments should be passed after the context');
				}, { usesElement: true }));

				return command.useElement('arg1');
			},

			'session usesElement multiple': function () {
				var command = new Command(session, function (setContext) {
					setContext([ 'a', 'b' ]);
				});

				var expected = [
					[ 'a', 'arg1' ],
					[ 'b', 'arg1' ]
				];

				Command.addSessionMethod(command, 'useElement', util.forCommand(function (context, arg) {
					var _expected = expected.shift();

					assert.strictEqual(context, _expected[0],
						'Context object should be passed as first argument to function annotated with usesElement');
					assert.strictEqual(arg, _expected[1],
						'Arguments should be passed after the context');
				}, { usesElement: true }));

				return command.useElement('arg1');
			}
		};
	});
});
