/* jshint dojo:true */
/* jshint browser:true */
define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!dojo/Promise',
	'./support/util',
	'intern/dojo/node!../../../lib/strategies',
	'require'
], function (registerSuite, assert, Promise, util, strategies, require) {
	registerSuite(function () {
		var session;
		var resetBrowserState = true;

		function createStubbedSuite(stubbedMethodName, testMethodName, placeholders, firstArguments) {
			var originalMethod;
			var calledWith;
			var extraArguments = [];
			var suite = {
				setup: function () {
					originalMethod = session[stubbedMethodName];
					session[stubbedMethodName] = function () {
						calledWith = arguments;
					};

					for (var i = 0, j = originalMethod.length - 1; i < j; ++i) {
						extraArguments.push('ok' + (i + 2));
					}
				},
				beforeEach: function () {
					calledWith = null;
				},

				teardown: function () {
					session[stubbedMethodName] = originalMethod;
				}
			};

			placeholders.forEach(function (placeholder, index) {
				var method = testMethodName.replace('_', placeholder);

				suite['#' + method] = function () {
					assert.isFunction(session[method]);
					session[method].apply(session, extraArguments);
					assert.ok(calledWith);
					assert.strictEqual(calledWith[0], firstArguments[index]);
					assert.deepEqual(Array.prototype.slice.call(calledWith, 1), extraArguments);
				};
			});

			return suite;
		}

		function createStorageTests(type) {
			var clear = 'clear' + type + 'Storage';
			var getKeys = 'get' + type + 'StorageKeys';
			var get = 'get' + type + 'StorageItem';
			var set = 'set' + type + 'StorageItem';
			var del = 'delete' + type + 'StorageItem';
			var getLength = 'get' + type + 'StorageLength';

			return function () {
				if (!session.capabilities.webStorageEnabled) {
					this.skip('web storage not enabled');
				}

				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session[set]('foo', 'foo');
				}).then(function () {
					return session[clear]();
				}).then(function () {
					return session[getLength]();
				}).then(function (length) {
					assert.strictEqual(length, 0, 'Cleared storage should contain no data');
					return session[set]('foo', 'foo');
				}).then(function () {
					return session[set]('bar', 'bar');
				}).then(function () {
					return session[set]('foo', 'foofoo');
				}).then(function () {
					return session[getLength]();
				}).then(function (length) {
					assert.strictEqual(length, 2, 'Getting size should return the number of data items in storage');
					return session[getKeys]();
				}).then(function (keys) {
					assert.sameMembers(keys, [ 'foo', 'bar' ], 'Storage should contain set keys');
					return session[get]('foo');
				}).then(function (value) {
					assert.strictEqual(value, 'foofoo', 'Getting item should retrieve correct stored value');
					return session[del]('not-existing');
				}).then(function () {
					return session[getLength]();
				}).then(function (length) {
					assert.strictEqual(length, 2, 'Deleting non-existing key should not change size of storage');
					return session[del]('foo');
				}).then(function () {
					return session[getKeys]();
				}).then(function (keys) {
					assert.deepEqual(keys, [ 'bar' ], 'Deleting existing key should reduce size of storage');
					return session[clear]();
				}).catch(function (error) {
					return session[clear]().then(function () {
						throw error;
					});
				});
			};
		}

		function getScrollPosition(element) {
			// touchScroll scrolls in device pixels; scroll position is normally in reference pixels,
			// so get the correct device pixel location to verify that it worked properly
			return session.execute(function (element) {
				if (!element) {
					element = document.documentElement;
					if (!element.scrollLeft && !element.scrollTop) {
						element = document.body;
					}
				}

				return {
					x: element.scrollLeft,
					y: element.scrollTop
				};
			}, [ element ]);
		}

		return {
			name: 'Session',

			setup: function () {
				return util.createSessionFromRemote(this.remote).then(function () {
					session = arguments[0];
				});
			},

			beforeEach: function () {
				if (resetBrowserState) {
					return session.get('about:blank').then(function () {
						return session.setTimeout('implicit', 0);
					});
				}
			},

			'#getTimeout script': function () {
				if (!session.capabilities.supportsExecuteAsync) {
					this.skip('executeAsync not supported');
				}

				return session.getTimeout('script').then(function (value) {
					assert.strictEqual(value, 0, 'Async execution timeout should be default value');
				});
			},

			'#getTimeout implicit': function () {
				return session.getTimeout('implicit').then(function (value) {
					assert.strictEqual(value, 0, 'Implicit timeout should be default value');
				});
			},

			'#getTimeout page load': function () {
				return session.getTimeout('page load').then(function (value) {
					assert.strictEqual(value, Infinity, 'Page load timeout should be default value');
				});
			},

			'#getTimeout convenience methods': createStubbedSuite(
				'getTimeout',
				'get_Timeout',
				[ 'ExecuteAsync', 'Find', 'PageLoad' ],
				[ 'script', 'implicit', 'page load' ]
			),

			'#setTimeout convenience methods': createStubbedSuite(
				'setTimeout',
				'set_Timeout',
				[ 'ExecuteAsync', 'Find', 'PageLoad' ],
				[ 'script', 'implicit', 'page load' ]
			),

			'window handle information (#getCurrentWindowHandle, #getAllWindowHandles)': function () {
				var currentHandle;

				return session.getCurrentWindowHandle().then(function (handle) {
					assert.isString(handle);
					currentHandle = handle;
					return session.getAllWindowHandles();
				}).then(function (handles) {
					assert.isArray(handles);

					// At least Selendroid 0.9.0 runs the browser inside a WebView wrapper; this is not really a
					// test failure
					if (handles[0] === 'NATIVE_APP' && handles[1]) {
						handles.shift();
					}

					// At least ios-driver 0.6.0-SNAPSHOT April 2014 runs the browser inside a WebView wrapper; this
					// is not really a test failure
					if (handles[1] === 'Native') {
						handles.pop();
					}

					assert.lengthOf(handles, 1);
					assert.strictEqual(handles[0], currentHandle);
				});
			},

			'#get': function () {
				return session.get(require.toUrl('./data/default.html'));
			},

			'#get 404': function () {
				return session.get(require.toUrl('./data/404.html'));
			},

			'#getCurrentUrl': function () {
				var expectedUrl = util.convertPathToUrl(this.remote, require.toUrl('./data/default.html'));

				return session.get(expectedUrl).then(function () {
					return session.getCurrentUrl();
				}).then(function (currentUrl) {
					assert.strictEqual(currentUrl, expectedUrl);
				});
			},

			'navigation (#goBack, #goForward, #refresh)': function () {
				if (session.capabilities.brokenNavigation) {
					this.skip('navigation is broken');
				}

				var expectedUrl = util.convertPathToUrl(this.remote, require.toUrl('./data/default.html?second'));
				var expectedBackUrl = util.convertPathToUrl(this.remote, require.toUrl('./data/default.html?first'));

				return session.get(expectedBackUrl).then(function () {
					return session.get(expectedUrl);
				}).then(function () {
					return session.goBack();
				}).then(function () {
					return session.getCurrentUrl();
				}).then(function (currentUrl) {
					assert.strictEqual(currentUrl, expectedBackUrl);
					return session.goForward();
				}).then(function () {
					return session.getCurrentUrl();
				}).then(function (currentUrl) {
					assert.strictEqual(currentUrl, expectedUrl);
					return session.refresh();
				}).then(function () {
					return session.getCurrentUrl();
				}).then(function (currentUrl) {
					assert.strictEqual(currentUrl, expectedUrl, 'Refreshing the page should load the same URL');
				});
			},

			'#execute string': function () {
				return session.get(require.toUrl('./data/scripting.html'))
					.then(function () {
						return session.execute(
							'return interns[arguments[0]] + interns[arguments[1]];',
							[ 'ness', 'paula' ]
						);
					})
					.then(function (result) {
						assert.strictEqual(result, 'NessPaula');
					});
			},

			'#execute function': function () {
				return session.get(require.toUrl('./data/scripting.html'))
					.then(function () {
						return session.execute(function (first, second) {
							/*global interns:false */
							return interns[first] + interns[second];
						}, [ 'ness', 'paula' ]);
					})
					.then(function (result) {
						assert.strictEqual(result, 'NessPaula');
					});
			},

			'#execute -> element': function () {
				if (session.capabilities.brokenExecuteElementReturn) {
					this.skip('execute element broken');
				}

				return session.get(require.toUrl('./data/scripting.html'))
					.then(function () {
						return session.execute(function () {
							return document.getElementById('child');
						});
					})
					.then(function (element) {
						assert.property(element, 'elementId', 'Returned value should be an Element object');
						return element.getAttribute('id');
					}).then(function (id) {
						assert.strictEqual(id, 'child');
					});
			},

			'#execute -> elements': function () {
				if (session.capabilities.brokenExecuteElementReturn) {
					this.skip('execute element broken');
				}

				return session.get(require.toUrl('./data/scripting.html'))
					.then(function () {
						return session.execute(function () {
							return [ interns.poo, document.getElementById('child') ];
						});
					})
					.then(function (elements) {
						assert.isArray(elements);
						assert.strictEqual(elements[0], 'Poo', 'Non-elements should not be converted');
						assert.property(elements[1], 'elementId', 'Returned elements should be Element objects');
						return elements[1].getAttribute('id');
					}).then(function (id) {
						assert.strictEqual(id, 'child');
					});
			},

			'#execute -> error': function () {
				return session.get(require.toUrl('./data/scripting.html'))
					.then(function () {
						return session.execute(function () {
							/*global interns:false */
							return interns();
						});
					})
					.then(function () {
						throw new Error('Invalid code execution should throw error');
					}, function (error) {
						assert.strictEqual(
							error.name,
							'JavaScriptError',
							'Invalid user code should throw per the spec'
						);
					});
			},

			'#execute -> undefined': function () {
				return session.get(require.toUrl('./data/scripting.html'))
					.then(function () {
						return Promise.all([
							session.execute('return "not undefined";'),
							session.execute('return undefined;')
						]);
					})
					.then(function (values) {
						assert.deepEqual(values, [ 'not undefined', null ]);
					});
			},

			'#execute non-array args': function () {
				assert.throws(function () {
					session.execute('return window;', 'oops');
				}, /Arguments passed to execute must be an array/);
			},

			'#executeAsync non-array args': function () {
				assert.throws(function () {
					session.executeAsync('return window;', 'oops');
				}, /Arguments passed to executeAsync must be an array/);
			},

			'#executeAsync': (function () {
				var originalTimeout;

				return {
					setup: function () {
						if (!session.capabilities.supportsExecuteAsync) {
							this.skip('executeAsync not supported');
						}

						return session.getTimeout('script').then(function (value) {
							originalTimeout = value;
							return session.setTimeout('script', 1000);
						});
					},
					'string': function () {
						if (!session.capabilities.supportsExecuteAsync) {
							this.skip('executeAsync not supported');
						}

						return session.get(require.toUrl('./data/scripting.html'))
							.then(function () {
								/*jshint maxlen:140 */
								return session.executeAsync(
									'var args = arguments; setTimeout(function () { args[2](interns[args[0]] + ' +
										'interns[args[1]]); }, 100);',
									[ 'ness', 'paula' ]
								);
							})
							.then(function (result) {
								assert.strictEqual(result, 'NessPaula');
							});
					},
					'function': function () {
						if (!session.capabilities.supportsExecuteAsync) {
							this.skip('executeAsync not supported');
						}

						return session.get(require.toUrl('./data/scripting.html'))
							.then(function () {
								return session.executeAsync(function (first, second, done) {
									setTimeout(function () {
										done(interns[first] + interns[second]);
									}, 100);
								}, [ 'ness', 'paula' ]);
							})
							.then(function (result) {
								assert.strictEqual(result, 'NessPaula');
							});
					},
					' -> error': function () {
						if (!session.capabilities.supportsExecuteAsync) {
							this.skip('executeAsync not supported');
						}

						return session.get(require.toUrl('./data/scripting.html'))
							.then(function () {
								return session.executeAsync(function (done) {
									/*global interns:false */
									done(interns());
								});
							})
							.then(function () {
								throw new Error('Invalid code execution should throw error');
							}, function (error) {
								assert.strictEqual(
									error.name,
									'JavaScriptError',
									'Invalid user code should throw an error matching the spec'
								);
							});
					},
					teardown: function () {
						if (!session.capabilities.supportsExecuteAsync) {
							this.skip('executeAsync not supported');
						}

						return session.setTimeout('script', originalTimeout);
					}
				};
			})(),

			'#takeScreenshot': function () {
				if (!session.capabilities.takesScreenshot) {
					this.skip('screenshots not supported');
				}

				var magic = [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ];

				this.async(30000);

				return session.takeScreenshot().then(function (screenshot) {
					/*jshint node:true */
					assert.isTrue(Buffer.isBuffer(screenshot), 'Screenshot should be a Buffer');
					assert.deepEqual(screenshot.slice(0, 8).toJSON().data, magic, 'Screenshot should be a PNG file');
				});
			},

			// TODO: There appear to be no drivers that support IME input to actually test IME commands

			'frame switching (#switchToFrame, #switchToParentFrame)': function () {
				if (session.capabilities.brokenParentFrameSwitch) {
					this.skip('switch to parent frame not supported');
				}

				return session.get(require.toUrl('./data/window.html')).then(function () {
					return session.findById('child');
				})
				.then(function (child) {
					return child.getVisibleText();
				})
				.then(function (text) {
					assert.strictEqual(text, 'Main');
					return session.switchToFrame('inlineFrame');
				})
				.then(function () {
					return session.findById('child');
				})
				.then(function (child) {
					return child.getVisibleText();
				})
				.then(function (text) {
					assert.strictEqual(text, 'Frame');

					if (session.capabilities.scriptedParentFrameCrashesBrowser) {
						return session.switchToFrame(null);
					}

					return session.switchToParentFrame();
				})
				.then(function () {
					return session.findById('child');
				})
				.then(function (child) {
					return child.getVisibleText();
				})
				.then(function (text) {
					assert.strictEqual(text, 'Main');
				});
			},

			'window switching (#switchToWindow, #closeCurrentWindow)': function () {
				if (session.capabilities.brokenWindowSwitch) {
					this.skip('window switching is broken');
				}

				if (session.capabilities.brokenWindowClose) {
					this.skip('window closing is broken');
				}

				var mainHandle;
				var popupHandle;
				var allHandles;

				return session.get(require.toUrl('./data/window.html')).then(function () {
					return session.getAllWindowHandles();
				}).then(function (handles) {
					allHandles = handles;
					return session.getCurrentWindowHandle();
				}).then(function (handle) {
					mainHandle = handle;
					return session.findById('windowOpener');
				}).then(function (opener) {
					return opener.click();
				}).then(function () {
					// Give the new window time to open
					return new Promise(function (resolve) {
						setTimeout(resolve, 1000);
					});
				}).then(function () {
					return session.getAllWindowHandles().then(function (handles) {
						assert.lengthOf(handles, allHandles.length + 1, 'New handle should have been created');

						// Return the new handle
						for (var i = 0; i < handles.length; i++) {
							if (allHandles.indexOf(handles[i]) === -1) {
								return handles[i];
							}
						}
					});
				}).then(function (newHandle) {
					popupHandle = newHandle;
					return session.switchToWindow(newHandle);
				}).then(function () {
					return session.getCurrentWindowHandle();
				}).then(function (handle) {
					assert.strictEqual(handle, popupHandle, 'Window handle should have switched to pop-up');
					return session.closeCurrentWindow();
				}).then(function () {
					return session.getCurrentWindowHandle().then(function () {
						throw new Error('Window should have closed');
					}, function (error) {
						assert.strictEqual(error.name, 'NoSuchWindow');
						return session.switchToWindow(mainHandle);
					});
				}).then(function () {
					return session.getCurrentWindowHandle();
				}).then(function (handle) {
					assert.strictEqual(handle, mainHandle, 'Window handle should have switched back to main window');
				});
			},

			'window sizing (#getWindowSize, #setWindowSize)': function () {
				if (session.capabilities.brokenWindowSize) {
					this.skip('window size commands are broken');
				}

				var originalSize;
				var resizedSize;
				return session.getWindowSize().then(function (size) {
					assert.property(size, 'width');
					assert.property(size, 'height');
					originalSize = size;

					if (session.capabilities.dynamicViewport) {
						return session.setWindowSize(size.width - 20, size.height - 20).then(function () {
							return session.getWindowSize();
						}).then(function (size) {
							assert.strictEqual(size.width, originalSize.width - 20);
							assert.strictEqual(size.height, originalSize.height - 20);
							resizedSize = size;
							return session.maximizeWindow();
						}).then(function () {
							return session.getWindowSize();
						}).then(function (size) {
							assert.operator(size.width, '>', resizedSize.width);
							assert.operator(size.height, '>', resizedSize.height);
						}).then(function () {
							return session.setWindowSize(originalSize.width, originalSize.height);
						});
					}
				});
			},

			'window positioning (#getWindowPosition, #setWindowPosition)': function () {
				if (!session.capabilities.dynamicViewport) {
					this.skip('dynamic viewport not supported');
				}
				if (session.capabilities.brokenWindowPosition) {
					this.skip('window position is broken');
				}

				var originalPosition;
				return session.getWindowPosition().then(function (position) {
					assert.property(position, 'x');
					assert.property(position, 'y');
					originalPosition = position;

					return session.setWindowPosition(position.x + 2, position.y + 2);
				}).then(function () {
					return session.getWindowPosition();
				}).then(function (position) {
					assert.deepEqual(position, { x: originalPosition.x + 2, y: originalPosition.y + 2 });
				});
			},

			'cookies (#getCookies, #setCookie, #clearCookies, #deleteCookie)': function () {
				if (session.capabilities.brokenCookies) {
					this.skip('cookies are broken');
				}

				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.setCookie({ name: 'foo', value: '1=3' });
				}).then(function () {
					return session.clearCookies();
				}).then(function () {
					return session.getCookies();
				}).then(function (cookies) {
					assert.lengthOf(cookies, 0, 'Clearing cookies should cause no cookies to exist');
					return session.setCookie({ name: 'foo', value: '1=3' });
				}).then(function () {
					return session.setCookie({ name: 'bar', value: '2=4' });
				}).then(function () {
					return session.setCookie({ name: 'baz', value: '3=5' });
				}).then(function () {
					return session.getCookies();
				}).then(function (cookies) {
					assert.lengthOf(cookies, 3, 'Setting cookies with unique names should create new cookies');

					return session.setCookie({ name: 'baz', value: '4=6' });
				}).then(function () {
					return session.getCookies();
				}).then(function (cookies) {
					assert.lengthOf(cookies, 3, 'Overwriting cookies should not cause new cookies to be created');
					return session.deleteCookie('bar');
				}).then(function () {
					return session.getCookies();
				}).then(function (cookies) {
					assert.lengthOf(cookies, 2, 'Deleting a cookie should reduce the number of cookies');

					// Different browsers return cookies in different orders; some return the last modified cookie
					// first, others return the first created cookie first
					var fooCookie = cookies[0].name === 'foo' ? cookies[0] : cookies[1];
					var bazCookie = cookies[0].name === 'baz' ? cookies[0] : cookies[1];

					assert.strictEqual(bazCookie.name, 'baz');
					assert.strictEqual(bazCookie.value, '4=6');
					assert.strictEqual(fooCookie.name, 'foo');
					assert.strictEqual(fooCookie.value, '1=3');
					return session.clearCookies();
				}).then(function () {
					return session.getCookies();
				}).then(function (cookies) {
					assert.lengthOf(cookies, 0);
					return session.clearCookies();
				}).catch(function (error) {
					return session.clearCookies().then(function () {
						throw error;
					});
				});
			},

			'#getPageSource': function () {
				// Page source is serialised from the current DOM, so will not match the original source on file
				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.getPageSource();
				}).then(function (source) {
					assert.include(source, '<meta charset="utf-8"');
					assert.include(source, '<title>Default &amp;');
					assert.include(source, 'Are you kay-o?');
				});
			},

			'#getPageTitle': function () {
				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.getPageTitle();
				}).then(function (pageTitle) {
					assert.strictEqual(pageTitle, 'Default & <b>default</b>');
				});
			},

			'#find': (function () {
				function getId(element) {
					assert.property(element, 'elementId', 'Returned object should look like an element object');
					return element.getAttribute('id');
				}

				return {
					setup: function () {
						resetBrowserState = false;
						return session.get(require.toUrl('./data/elements.html'));
					},

					teardown: function () {
						resetBrowserState = true;
					},

					'by id': function () {
						return session.find('id', 'a')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'a');
							});
					},

					'by class name': function () {
						return session.find('class name', 'b')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'b2', 'Returned element should be the first in the document');
							});
					},

					'by css selector': function () {
						return session.find('css selector', '#c span.b')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'b3');
							});
					},

					'by name': function () {
						return session.find('name', 'makeD')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'makeD');
							});
					},

					'by link text': function () {
						return session.find('link text', 'What a cute, yellow backpack.')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'c');
							});
					},

					'by partial link text': function () {
						return session.find('partial link text', 'cute, yellow')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'c');
							});
					},

					'by link text (hidden text)': function () {
						return session.find('link text', 'What a cute backpack.')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'c3');
							});
					},

					'by partial link text (hidden text)': function () {
						return session.find('partial link text', 'cute backpack')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'c3');
							});
					},

					'by tag name': function () {
						return session.find('tag name', 'span')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'b3');
							});
					},

					'by xpath': function () {
						return session.find('xpath', 'id("e")/span[1]')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'f');
							});
					},

					'non-existent element': function () {
						return session.find('id', 'does-not-exist').then(
							function () {
								throw new Error('Requesting non-existing element should throw error');
							},
							function (error) {
								if (error.name !== 'NoSuchElement') {
									throw error;
								}
							}
						);
					}
				};
			})(),

			'#find (with implicit timeout)': (function () {
				var startTime;
				return function () {
					return session.get(require.toUrl('./data/elements.html')).then(function () {
						return session.setTimeout('implicit', 2000);
					}).then(function () {
						startTime = Date.now();
						return session.find('id', 'd').then(
							function () {
								throw new Error('Requesting non-existing element should throw error');
							},
							function () {
								assert.operator(Date.now(), '>=', startTime + 2000,
									'Driver should wait for implicit timeout before continuing');
							}
						);
					}).then(function () {
						return session.find('id', 'makeD');
					}).then(function (element) {
						return element.click();
					}).then(function () {
						return session.setTimeout('implicit', 10000);
					}).then(function () {
						startTime = Date.now();
						return session.find('id', 'd');
					}).then(function (element) {
						assert.operator(Date.now(), '<', startTime + 9000,
							'Driver should not wait until end of implicit timeout once element is available');
						assert.property(element, 'elementId');
						return element.getAttribute('id');
					}).then(function (id) {
						assert.strictEqual(id, 'd');
					});
				};
			})(),

			'#findAll': (function () {
				function getIds(elements) {
					elements.forEach(function (element, index) {
						assert.property(element, 'elementId', 'Returned object ' + index +
							' should look like an element object');
					});

					return Promise.all(elements.map(function (element) {
						return element.getAttribute('id');
					}));
				}

				return {
					setup: function () {
						resetBrowserState = false;
						return session.get(require.toUrl('./data/elements.html'));
					},

					teardown: function () {
						resetBrowserState = true;
					},

					'by id': function () {
						return session.findAll('id', 'a')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'a' ]);
							});
					},

					'by class name': function () {
						return session.findAll('class name', 'b')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'b2', 'b1', 'b3', 'b4' ]);
							});
					},

					'by css selecctor': function () {
						return session.findAll('css selector', '#c span.b')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'b3', 'b4' ]);
							});
					},

					'by name': function () {
						return session.findAll('name', 'makeD')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'makeD', 'killE' ]);
							});
					},

					'by link text': function () {
						return session.findAll('link text', 'What a cute, yellow backpack.')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'c', 'c2' ]);
							});
					},

					'by partial link text': function () {
						return session.findAll('partial link text', 'cute, yellow')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'c', 'c2' ]);
							});
					},

					'by link text (hidden text)': function () {
						return session.findAll('link text', 'What a cute backpack.')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'c3' ]);
							});
					},

					'by partial link text (hidden text)': function () {
						return session.findAll('partial link text', 'cute backpack')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'c3' ]);
							});
					},

					'by tag name': function () {
						return session.findAll('tag name', 'span')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'b3', 'b4', 'f', 'g' ]);
							});
					},

					'by xpath': function () {
						return session.findAll('xpath', 'id("e")/span')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'f', 'g' ]);
							});
					},

					'non-existent': function () {
						return session.findAll('id', 'does-not-exist')
							.then(function (elements) {
								assert.deepEqual(elements, []);
							});
					}
				};
			})(),

			'#findDisplayed': function () {
				if (session.capabilities.brokenElementSerialization) {
					this.skip('element serialization is broken');
				}

				return session.get(require.toUrl('./data/visibility.html')).then(function () {
					return session.findDisplayed('id', 'does-not-exist').then(
						function () {
							throw new Error('findDisplayed should not find non-existing elements');
						},
						function (error) {
							assert.strictEqual(error.name, 'NoSuchElement',
								'Non-existing element should throw NoSuchElement error after timeout');
						}
					);
				}).then(function () {
					return session.findDisplayed('id', 'noDisplay').then(
						function () {
							throw new Error('findDisplayed should not find hidden elements');
						},
						function (error) {
							assert.strictEqual(error.name, 'ElementNotVisible',
								'Existing but hidden element should throw ElementNotVisible error after timeout');
						}
					);
				}).then(function () {
					return session.findDisplayed('class name', 'multipleVisible');
				}).then(function (element) {
					return element.getVisibleText();
				}).then(function (text) {
					assert.strictEqual(text, 'b',
						'The first visible element should be returned, even if it is not the first' +
						' element of any visibility that matches the query');

					return session.setFindTimeout(2000);
				}).then(function () {
					return session.findById('makeVisible');
				}).then(function (element) {
					return element.click();
				}).then(function () {
					return session.findDisplayed('id', 'noDisplay');
				}).then(function (element) {
					return element.getProperty('id');
				}).then(function (id) {
					assert.strictEqual(id, 'noDisplay');
				});
			},

			'#find convenience methods': createStubbedSuite(
				'find',
				'findBy_',
				strategies.suffixes,
				strategies
			),

			'#findAll convenience methods': createStubbedSuite(
				'findAll',
				'findAllBy_',
				strategies.suffixes.filter(function (suffix) { return suffix !== 'Id'; }),
				strategies.filter(function (strategy) { return strategy !== 'id'; })
			),

			'#findDisplayed convenience methods': createStubbedSuite(
				'findDisplayed',
				'findDisplayedBy_',
				strategies.suffixes,
				strategies
			),

			'#waitForDeleted': function () {
				var startTime;

				return session.get(require.toUrl('./data/elements.html')).then(function () {
					// Verifies element to be deleted exists at the start of the test
					return session.findById('e');
				}).then(function () {
					return session.setFindTimeout(5000);
				}).then(function () {
					return session.findById('killE');
				}).then(function (element) {
					startTime = Date.now();
					return element.click();
				}).then(function () {
					return session.waitForDeleted('id', 'e');
				}).then(function () {
					var timeSpent = Date.now() - startTime;
					assert.operator(timeSpent, '>', 250,
						'Waiting for deleted should wait until element is gone');
					assert.operator(timeSpent, '<', 5000,
						'Waiting for deleted should not wait until end of implicit timeout once element is gone');
				});
			},

			'#waitForDeleted -> timeout': function () {
				var startTime;

				return session.get(require.toUrl('./data/elements.html')).then(function () {
					// Verifies element to be deleted exists at the start of the test
					return session.findById('e');
				}).then(function () {
					return session.setFindTimeout(200);
				}).then(function () {
					startTime = Date.now();
					return session.waitForDeleted('id', 'e');
				}).then(function () {
					throw new Error('Waiting for deleted element that never disappears should time out');
				}, function () {
					assert.operator(Date.now() - startTime, '>', 200,
						'Failure should not occur until after the implicit timeout has expired');
				});
			},

			'#waitForDeleted convenience methods': createStubbedSuite(
				'waitForDeleted',
				'waitForDeletedBy_',
				strategies.suffixes,
				strategies
			),

			'#getActiveElement': function () {
				if (session.capabilities.brokenElementSerialization) {
					this.skip('element serialization is broken');
				}

				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.getActiveElement();
				}).then(function (element) {
					return element.getTagName();
				}).then(function (tagName) {
					assert.strictEqual(tagName, 'body');
					return session.execute(function () {
						document.getElementById('input').focus();
					});
				}).then(function () {
					return session.getActiveElement();
				}).then(function (element) {
					return element.getAttribute('id');
				}).then(function (id) {
					assert.strictEqual(id, 'input');
				});
			},

			'#pressKeys': function () {
				var formElement;

				// TODO: Complex characters, tabs and arrows, copy and paste
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('input');
				}).then(function (element) {
					formElement = element;
					return element.click();
				}).then(function () {
					return session.pressKeys('hello, world');
				}).then(function () {
					return formElement.getProperty('value');
				}).then(function (value) {
					assert.strictEqual(value, 'hello, world');
				});
			},

			'#getOrientation': function () {
				if (!session.capabilities.rotatable) {
					this.skip('not rotatable');
				}

				return session.getOrientation().then(function (value) {
					assert.include([ 'PORTRAIT', 'LANDSCAPE' ], value);
				});
			},

			'#setOrientation': function () {
				if (!session.capabilities.rotatable) {
					this.skip('not rotatable');
				}

				return session.setOrientation('LANDSCAPE').then(function () {
					return session.setOrientation('PORTRAIT');
				});
			},

			'#getAlertText': function () {
				if (!session.capabilities.handlesAlerts) {
					this.skip('cannot handle alerts');
				}

				return session.get(require.toUrl('./data/prompts.html')).then(function () {
					return session.findById('alert');
				}).then(function (element) {
					return element.click();
				}).then(function () {
					return session.getAlertText();
				}).then(function (alertText) {
					assert.strictEqual(alertText, 'Oh, you thank.');
					return session.acceptAlert();
				}).then(function () {
					return session.execute('return result.alert;');
				}).then(function (result) {
					assert.isTrue(result);
				});
			},

			'#typeInPrompt': function () {
				if (!session.capabilities.handlesAlerts) {
					this.skip('cannot handle alerts');
				}

				return session.get(require.toUrl('./data/prompts.html')).then(function () {
					return session.findById('prompt');
				}).then(function (element) {
					return element.click();
				}).then(function () {
					return session.getAlertText();
				}).then(function (alertText) {
					assert.strictEqual(alertText, 'The monkey... got charred. Is he all right?');
					return session.typeInPrompt('yes');
				}).then(function () {
					return session.acceptAlert();
				}).then(function () {
					return session.execute('return result.prompt;');
				}).then(function (result) {
					assert.strictEqual(result, 'yes');
				});
			},

			'#typeInPrompt array': function () {
				if (!session.capabilities.handlesAlerts) {
					this.skip('cannot handle alerts');
				}

				return session.get(require.toUrl('./data/prompts.html')).then(function () {
					return session.findById('prompt');
				}).then(function (element) {
					return element.click();
				}).then(function () {
					return session.getAlertText();
				}).then(function (alertText) {
					assert.strictEqual(alertText, 'The monkey... got charred. Is he all right?');
					return session.typeInPrompt([ 'y', 'e', 's' ]);
				}).then(function () {
					return session.acceptAlert();
				}).then(function () {
					return session.execute('return result.prompt;');
				}).then(function (result) {
					assert.strictEqual(result, 'yes');
				});
			},

			'#acceptAlert': function () {
				if (!session.capabilities.handlesAlerts) {
					this.skip('cannot handle alerts');
				}

				return session.get(require.toUrl('./data/prompts.html')).then(function () {
					return session.findById('confirm');
				}).then(function (element) {
					return element.click();
				}).then(function () {
					return session.getAlertText();
				}).then(function (alertText) {
					assert.strictEqual(alertText, 'Would you like some bananas?');
					return session.acceptAlert();
				}).then(function () {
					return session.execute('return result.confirm;');
				}).then(function (result) {
					assert.isTrue(result);
				});
			},

			'#dismissAlert': function () {
				if (!session.capabilities.handlesAlerts) {
					this.skip('cannot handle alerts');
				}

				return session.get(require.toUrl('./data/prompts.html')).then(function () {
					return session.findById('confirm');
				}).then(function (element) {
					return element.click();
				}).then(function () {
					return session.getAlertText();
				}).then(function (alertText) {
					assert.strictEqual(alertText, 'Would you like some bananas?');
					return session.dismissAlert();
				}).then(function () {
					return session.execute('return result.confirm;');
				}).then(function (result) {
					assert.isFalse(result);
				});
			},

			'#moveMouseTo': function () {
				/*jshint maxlen:140 */
				if (!session.capabilities.mouseEnabled) {
					this.skip('mouse not enabled');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.moveMouseTo(100, 12);
				}).then(function () {
					return session.execute(
						'return result.mousemove.a && result.mousemove.a[result.mousemove.a.length - 1];');
				}).then(function (event) {
					assert.isObject(event);
					assert.strictEqual(event.clientX, 100);
					assert.strictEqual(event.clientY, 12);
					return session.moveMouseTo(100, 41);
				}).then(function () {
					return session.execute(
						'return result.mousemove.b && result.mousemove.b[result.mousemove.b.length - 1];');
				}).then(function (event) {
					assert.isObject(event);
					assert.strictEqual(event.clientX, 200);
					assert.strictEqual(event.clientY, 53);
					return session.findById('c');
				}).then(function (element) {
					return session.moveMouseTo(element).then(function () {
						return session.execute(
							'return result.mousemove.c && result.mousemove.c[result.mousemove.c.length - 1];');
					}).then(function (event) {
						assert.isObject(event);
						assert.closeTo(event.clientX, 450, 4);
						assert.closeTo(event.clientY, 90, 4);
						return session.moveMouseTo(element, 2, 4);
					});
				}).then(function () {
					return session.execute(
						'return result.mousemove.c && result.mousemove.c[result.mousemove.c.length - 1];');
				}).then(function (event) {
					assert.isObject(event);
					assert.closeTo(event.clientX, 352, 4);
					assert.closeTo(event.clientY, 80, 4);
				});
			},

			'#clickMouseButton': function () {
				if (!session.capabilities.mouseEnabled) {
					this.skip('mouse not enabled');
				}

				function click(button) {
					/*jshint maxlen:140 */
					return function () {
						return session.clickMouseButton(button).then(function () {
							return session.execute('return result.click.a && result.click.a[0];');
						}).then(function (event) {
							assert.strictEqual(event.button, button);
							return session.execute(
								'return result.mousedown.a && result.mousedown.a[0];'
							).then(function (mouseDownEvent) {
								assert.closeTo(event.timeStamp, mouseDownEvent.timeStamp, 300);
								assert.operator(mouseDownEvent.timeStamp, '<=', event.timeStamp);
								return session.execute('return result.mouseup.a && result.mouseup.a[0];');
							}).then(function (mouseUpEvent) {
								assert.closeTo(event.timeStamp, mouseUpEvent.timeStamp, 300);
								assert.operator(mouseUpEvent.timeStamp, '<=', event.timeStamp);
							});
						});
					};
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return session.moveMouseTo(element);
				}).then(click(0));

				// TODO: Right-click/middle-click are unreliable in browsers; find a way to test them.
			},

			'#pressMouseButton, #releaseMouseButton': function () {
				if (!session.capabilities.mouseEnabled) {
					this.skip('mouse not enabled');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return session.moveMouseTo(element);
				}).then(function () {
					return session.pressMouseButton();
				}).then(function () {
					return session.findById('b');
				}).then(function (element) {
					return session.moveMouseTo(element);
				}).then(function () {
					return session.releaseMouseButton();
				}).then(function () {
					/*jshint maxlen:140 */
					return session.execute('return result;');
				}).then(function (result) {
					assert.isUndefined(result.mouseup.a);
					assert.isUndefined(result.mousedown.b);
					assert.lengthOf(result.mousedown.a, 1);
					assert.lengthOf(result.mouseup.b, 1);
				});
			},

			'#doubleClick': function () {
				if (!session.capabilities.mouseEnabled) {
					this.skip('mouse not enabled');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return session.moveMouseTo(element);
				}).then(function () {
					return session.doubleClick();
				}).then(function () {
					return session.execute('return result;');
				}).then(function (result) {
					assert.isArray(result.dblclick.a, 'dblclick should have occurred');
					assert.isArray(result.mousedown.a, 'mousedown should have occurred');
					assert.isArray(result.mouseup.a, 'mouseup should have occurred');
					assert.isArray(result.click.a, 'click should have occurred');
					assert.lengthOf(result.dblclick.a, 1, 'One dblclick should occur on double-click');
					assert.lengthOf(result.mousedown.a, 2, 'Two mousedown should occur on double-click');
					assert.lengthOf(result.mouseup.a, 2, 'Two mouseup should occur on double-click');
					assert.lengthOf(result.click.a, 2, 'Two click should occur on double-click');

					assert.operator(result.mousedown.a[1].timeStamp, '<=', result.mouseup.a[1].timeStamp);
					assert.operator(result.mouseup.a[1].timeStamp, '<=', result.click.a[1].timeStamp);
					assert.operator(result.click.a[1].timeStamp, '<=', result.dblclick.a[0].timeStamp);
				});
			},

			'#tap': function () {
				if (!session.capabilities.touchEnabled) {
					this.skip('touch not supported');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return session.tap(element);
				}).then(function () {
					return session.execute('return result;');
				}).then(function (result) {
					assert.lengthOf(result.touchstart.a, 1);
					assert.lengthOf(result.touchend.a, 1);

					assert.operator(result.touchstart.a[0].timeStamp, '<=', result.touchend.a[0].timeStamp);
				});
			},

			'#pressFinger, #releaseFinger, #moveFinger': function () {
				if (!session.capabilities.touchEnabled) {
					this.skip('touch not supported');
				}
				if (session.capabilities.brokenMoveFinger) {
					this.skip('move finger support is broken');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.pressFinger(5, 5);
				}).then(function () {
					return session.moveFinger(200, 53);
				}).then(function () {
					return session.releaseFinger(200, 53);
				}).then(function () {
					return session.execute('return result;');
				}).then(function (result) {
					assert.isUndefined(result.touchend.a);
					assert.isUndefined(result.touchstart.b);
					assert.lengthOf(result.touchstart.a, 1);
					assert.lengthOf(result.touchend.b, 1);
				});
			},

			'#touchScroll': function () {
				if (!session.capabilities.touchEnabled) {
					this.skip('touch is not enabled');
				}

				return session.get(require.toUrl('./data/scrollable.html'))
					.then(getScrollPosition)
					.then(function (position) {
						assert.deepEqual(position, { x: 0, y: 0 });
						return session.touchScroll(20, 40);
					}).then(getScrollPosition)
					.then(function (position) {
						assert.deepEqual(position, { x: 20, y: 40 });
						return session.findById('viewport');
					}).then(function (viewport) {
						return session.touchScroll(viewport, 100, 200);
					}).then(getScrollPosition).then(function (position) {
						assert.deepEqual(position, { x: 100, y: 3232 });
					});
			},

			'#doubleTap': function () {
				if (!session.capabilities.touchEnabled) {
					this.skip('touch is not enabled');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return session.doubleTap(element);
				}).then(function () {
					return session.execute('return result;');
				}).then(function (result) {
					assert.lengthOf(result.touchstart.a, 2);
					assert.lengthOf(result.touchend.a, 2);
				});
			},

			'#longTap': function () {
				if (!session.capabilities.touchEnabled) {
					this.skip('touch is not enabled');
				}
				if (session.capabilities.brokenLongTap) {
					this.skip('long tap is broken');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return session.longTap(element);
				}).then(function () {
					return session.execute('return result;');
				}).then(function (result) {
					assert.lengthOf(result.touchstart.a, 1);
					assert.lengthOf(result.touchend.a, 1);
					assert.operator(result.touchend.a[0].timeStamp - result.touchstart.a[0].timeStamp, '>=', 500);
				});
			},

			'#flickFinger (element)': function () {
				if (!session.capabilities.touchEnabled) {
					this.skip('touch is not enabled');
				}
				if (session.capabilities.brokenFlickFinger) {
					this.skip('flick finger is broken');
				}

				return session.get(require.toUrl('./data/scrollable.html'))
				.then(getScrollPosition)
				.then(function (originalPosition) {
					assert.deepEqual(originalPosition, { x: 0, y: 0 });
					return session.findByTagName('body').then(function (element) {
						return session.flickFinger(element, -100, -100, 100);
					}).then(getScrollPosition).then(function (position) {
						assert.operator(originalPosition.x, '<', position.x);
						assert.operator(originalPosition.y, '<', position.y);
					});
				}).then(function () {
					return session.findById('viewport');
				}).then(function (element) {
					return getScrollPosition(element).then(function (originalPosition) {
						return session.flickFinger(element, -100, -100, 100).then(function () {
							return getScrollPosition(element);
						}).then(function (position) {
							assert.operator(originalPosition.x, '<', position.x);
							assert.operator(originalPosition.y, '<', position.y);
						});
					});
				});
			},

			'#flickFinger (no element)': function () {
				if (!session.capabilities.touchEnabled) {
					this.skip('touch is not enabled');
				}
				if (session.capabilities.brokenFlickFinger) {
					this.skip('flick finger is broken');
				}

				return session.get(require.toUrl('./data/scrollable.html')).then(function () {
					return session.flickFinger(400, 400);
				}).then(getScrollPosition).then(function (position) {
					assert.operator(0, '<', position.x);
					assert.operator(0, '<', position.y);
				});
			},

			'geolocation (#getGeolocation, #setGeolocation)': function () {
				if (!session.capabilities.locationContextEnabled) {
					this.skip('location context not enabled');
				}

				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.setGeolocation({ latitude: 12, longitude: -22.334455, altitude: 1000 });
				}).then(function () {
					return session.getGeolocation();
				}).then(function (location) {
					assert.isObject(location);
					assert.strictEqual(location.latitude, 12);
					assert.strictEqual(location.longitude, -22.334455);

					// Geolocation implementations that cannot provide altitude information shall return `null`,
					// http://dev.w3.org/geo/api/spec-source.html#altitude
					if (location.altitude !== null) {
						assert.strictEqual(location.altitude, 1000);
					}
				});
			},

			'#getLogsFor': function () {
				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.getAvailableLogTypes();
				}).then(function (types) {
					if (!types.length) {
						return [];
					}

					return session.getLogsFor(types[0]);
				}).then(function (logs) {
					assert.isArray(logs);

					if (logs.length) {
						var log = logs[0];
						assert.isObject(log);
						assert.property(log, 'timestamp');
						assert.property(log, 'level');
						assert.property(log, 'message');
						assert.isNumber(log.timestamp);
						assert.isString(log.level);
						assert.isString(log.message);
					}
				});
			},

			'#getAvailableLogTypes': function () {
				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.getAvailableLogTypes();
				}).then(function (types) {
					assert.isArray(types);
				});
			},

			'#getApplicationCacheStatus': function () {
				if (!session.capabilities.applicationCacheEnabled) {
					this.skip('application cache is not enabled');
				}

				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.getApplicationCacheStatus();
				}).then(function (status) {
					assert.strictEqual(status, 0);
				});
			},

			'local storage': createStorageTests('Local'),
			'session storage': createStorageTests('Session')
		};
	});
});
