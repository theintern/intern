/* jshint dojo:true */
define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!dojo/Promise',
	'./support/util',
	'intern/dojo/node!../../lib/strategies',
	'intern/dojo/node!../../Command',
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
				},

				'catch recovery': function () {
					return new Command(session)
						.then(function () {
							throw new Error('Boom');
						}).catch(function () {
							var expected = [];
							expected.isSingle = true;
							expected.depth = 0;
							assert.deepEqual(this.context, expected, 'Context should be copied in error path');
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
					return Promise.resolve('bar');
				});

				var expectedContext = [ 'foo' ];
				expectedContext.isSingle = true;
				expectedContext.depth = 0;

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
				var child = parent.findByTagName('p');

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
					.findById('input')
						.click()
						.type('hello')
						.getProperty('value')
						.then(function (value) {
							assert.strictEqual(value, 'hello', 'Typing into a form field should put data in the field');
						});
			},

			'#findAll': function () {
				return new Command(session).get(require.toUrl('./data/elements.html'))
					.findAllByClassName('b')
					.getAttribute('id')
					.then(function (ids) {
						assert.deepEqual(ids, [ 'b2', 'b1', 'b3', 'b4' ]);
					});
			},

			'#findAll chain': function () {
				return new Command(session).get(require.toUrl('./data/elements.html'))
					.findById('c')
						.findAllByClassName('b')
							.getAttribute('id')
							.then(function (ids) {
								assert.deepEqual(ids, [ 'b3', 'b4' ]);
							})
							.findAllByClassName('a')
								.then(function (elements) {
									assert.lengthOf(elements, 0);
								})
						.end(2)
					.end()
					.findAllByClassName('b')
						.getAttribute('id')
						.then(function (ids) {
							assert.deepEqual(ids, [ 'b2', 'b1', 'b3', 'b4' ]);
						});
			},

			'#findAll + #findAll': function () {
				return new Command(session).get(require.toUrl('./data/elements.html'))
					.findAllByTagName('div')
						.findAllByCssSelector('span, a')
							.getAttribute('id')
							.then(function (ids) {
								assert.deepEqual(ids, [ 'f', 'g', 'j', 'i1', 'k', 'zz' ]);
							});
			},

			'#findDisplayed': function () {
				return new Command(session).get(require.toUrl('./data/visibility.html'))
					.findDisplayedByClassName('multipleVisible')
					.getVisibleText()
					.then(function (text) {
						assert.strictEqual(text, 'b', 'The first visible element should be returned');
					});
			},

			// Check that when the mouse is pressed on one element and is moved over another element before being
			// released, the mousedown event is generated for the first element and the mouseup event is generated for
			// the second.
			'#moveMouseTo usesElement': function () {
				return new Command(session).get(require.toUrl('./data/pointer.html'))
					.findById('a')
					.moveMouseTo()
					.pressMouseButton()
					.moveMouseTo(110, 50)
					.releaseMouseButton()
					.execute('return result;')
					.then(function (result) {
						assert.isTrue(result.mousedown.a && result.mousedown.a.length > 0, 'Expected mousedown event in element a');
						assert.isTrue(result.mouseup.b && result.mouseup.b.length > 0, 'Expected mouseup event in element b');
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
				var expected = [ 'a' ];
				expected.depth = 0;

				return new Command(session, function (setContext) { setContext([ 'a' ]); })
					.end(20)
					.then(function () {
						assert.deepEqual(this.context, expected, 'Calling #end when there is nowhere else to go should be a no-op');
					});
			},

			'#end in a long chain': function () {
				return new Command(session).then(function (_, setContext) {
					setContext([ 'a' ]);
				})
				.end()
				.then(function () {
					assert.lengthOf(this.context, 0);
				})
				.end()
				.then(function () {
					assert.lengthOf(this.context, 0, '#end should not ascend to higher depths earlier in the command chain');
				});
			},

			'#catch': function () {
				var command = new Command(session);
				var callback;
				var errback;
				var expectedErrback = function () {};
				command.then = function () {
					callback = arguments[0];
					errback = arguments[1];
					return 'thenCalled';
				};
				var result = command.catch(expectedErrback);
				assert.strictEqual(result, 'thenCalled');
				assert.isNull(callback);
				assert.strictEqual(errback, expectedErrback);
			},

			'#finally': function () {
				var command = new Command(session);
				var callback;
				var errback;
				var expected = function () {};
				command.then = function () {
					callback = arguments[0];
					errback = arguments[1];
					return 'thenCalled';
				};
				var result = command.finally(expected);
				assert.strictEqual(result, 'thenCalled');
				assert.strictEqual(callback, expected);
				assert.strictEqual(errback, expected);
			},

			'#cancel': function () {
				var command = new Command(session);
				var sleepCommand = command.sleep(5000);
				sleepCommand.cancel();

				var startTime = Date.now();

				return sleepCommand.then(function () {
					throw new Error('Sleep command should have been cancelled');
				}, function (error) {
					assert.operator(Date.now() - startTime, '<', 4000, 'Cancel should not wait for sleep to complete');
					assert.strictEqual(error.name, 'CancelError');
				});
			},

			'session createsContext': function () {
				var command = new Command(session, function (setContext) {
					setContext('a');
				});

				Command.addSessionMethod(command, 'newContext', util.forCommand(function () {
					return Promise.resolve('b');
				}, { createsContext: true }));

				return command.newContext().then(function () {
					var expected = [ 'b' ];
					expected.isSingle = true;
					expected.depth = 1;

					assert.deepEqual(this.context, expected,
						'Function that returns a value that has been annotated with createsContext should generate a new context');
				});
			},

			'element createsContext': function () {
				var command = new Command(session, function (setContext) {
					setContext({
						elementId: 'farts',
						newContext: util.forCommand(function () {
							return Promise.resolve('b');
						}, { createsContext: true })
					});
				});

				Command.addElementMethod(command, 'newContext');

				return command.newContext().then(function () {
					var expected = [ 'b' ];
					expected.isSingle = true;
					expected.depth = 1;

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
