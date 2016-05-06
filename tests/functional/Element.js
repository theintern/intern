/* jshint dojo:true */
define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!dojo/Promise',
	'./support/util',
	'intern/dojo/node!../../lib/strategies',
	'intern/dojo/node!../../Element',
	'require'
], function (registerSuite, assert, Promise, util, strategies, Element, require) {
	function createStubbedSuite(stubbedMethodName, testMethodName, placeholders, firstArguments) {
		var originalMethod;
		var calledWith;
		var extraArguments = [];
		var element = new Element('test');
		var suite = {
			setup: function () {
				originalMethod = element[stubbedMethodName];
				element[stubbedMethodName] = function () {
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
				element[stubbedMethodName] = originalMethod;
			}
		};

		placeholders.forEach(function (placeholder, index) {
			var method = testMethodName.replace('_', placeholder);

			suite['#' + method] = function () {
				assert.isFunction(element[method]);
				element[method].apply(element, extraArguments);
				assert.ok(calledWith);
				assert.strictEqual(calledWith[0], firstArguments[index]);
				assert.deepEqual(Array.prototype.slice.call(calledWith, 1), extraArguments);
			};
		});

		return suite;
	}

	registerSuite(function () {
		var session;
		var resetBrowserState = true;

		return {
			name: 'Element',

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

			'#toJSON': function () {
				var element = new Element('test');
				assert.deepEqual(element.toJSON(), { ELEMENT: 'test' });
			},

			'#find': (function () {
				function getId(element) {
					assert.property(element, 'elementId', 'Returned object should look like an element object');
					return element.getAttribute('id');
				}

				var element;

				return {
					setup: function () {
						resetBrowserState = false;
						return session.get(require.toUrl('./data/elements.html')).then(function () {
							return session.find('id', 'h');
						}).then(function (_element) {
							element = _element;
						});
					},

					teardown: function () {
						resetBrowserState = true;
					},

					'by class name': function () {
						return element.find('class name', 'i')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'i2', 'Returned element should be the first in the document');
							});
					},

					'by css selector': function () {
						return element.find('css selector', '#j b.i')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'i2');
							});
					},

					'by name': function () {
						return element.find('name', 'nothing')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'nothing1');
							});
					},

					'by link text': function () {
						return element.find('link text', 'What a cute, red cap.')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'j');
							});
					},

					'by partial link text': function () {
						return element.find('partial link text', 'cute, red')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'j');
							});
					},

					'by link text (hidden text)': function () {
						return element.find('link text', 'What a cap.')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'k');
							});
					},

					'by partial link text (hidden text)': function () {
						return element.find('partial link text', 'a cap')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'k');
							});
					},

					'by tag name': function () {
						return element.find('tag name', 'b')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'i2');
							});
					},

					'by xpath': function () {
						return element.find('xpath', 'id("h")/a[2]')
							.then(getId)
							.then(function (id) {
								assert.strictEqual(id, 'i1');
							});
					},

					'non-existent': function () {
						return element.find('id', 'does-not-exist').then(
							function () {
								throw new Error('Requesting non-existing element should throw error');
							},
							function (error) {
								assert.strictEqual(error.name, 'NoSuchElement');
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
						return session.find('id', 'h');
					}).then(function (element) {
						startTime = Date.now();
						return element.find('id', 'd').then(function () {
							throw new Error('Requesting non-existing element should throw error');
						}, function () {
							assert.operator(Date.now(), '>=', startTime + 2000,
								'Driver should wait for implicit timeout before continuing');
							return session.find('id', 'makeD');
						}).then(function (makeElement) {
							return makeElement.click();
						}).then(function () {
							return session.setTimeout('implicit', 10000);
						}).then(function () {
							startTime = Date.now();
							return element.find('id', 'd');
						}).then(function (child) {
							assert.operator(Date.now(), '<', startTime + 9000,
								'Driver should not wait until end of implicit timeout once element is available');
							assert.property(child, 'elementId');
							return child.getAttribute('id');
						}).then(function (id) {
							assert.strictEqual(id, 'd');
						});
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

				var element;

				return {
					setup: function () {
						resetBrowserState = false;
						return session.get(require.toUrl('./data/elements.html')).then(function () {
							return session.find('id', 'h');
						}).then(function (_element) {
							element = _element;
						});
					},

					teardown: function () {
						resetBrowserState = true;
					},

					'by id': function () {
						return element.findAll('id', 'j')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'j' ]);
							});
					},

					'by class name': function () {
						return element.findAll('class name', 'i')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'i2', 'i3', 'i1' ]);
							});
					},

					'by css selector': function () {
						return element.findAll('css selector', '#j b.i')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'i2', 'i3' ]);
							});
					},

					'by name': function () {
						return element.findAll('name', 'nothing')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'nothing1', 'nothing2' ]);
							});
					},

					'by link text': function () {
						return element.findAll('link text', 'What a cute, red cap.')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'j', 'i1' ]);
							});
					},

					'by partial link text': function () {
						return element.findAll('partial link text', 'cute, red')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'j', 'i1' ]);
							});
					},

					'by link text (hidden text)': function () {
						return element.findAll('link text', 'What a cap.')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'k' ]);
							});
					},

					'by partial link text (hidden text)': function () {
						return element.findAll('partial link text', 'a cap')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'k' ]);
							});
					},

					'by tag name': function () {
						return element.findAll('tag name', 'b')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'i2', 'i3', 'l' ]);
							});
					},

					'by xpath': function () {
						return element.findAll('xpath', 'id("j")/b')
							.then(getIds)
							.then(function (ids) {
								assert.deepEqual(ids, [ 'i2', 'i3' ]);
							});
					},

					'non-existent': function () {
						return element.findAll('id', 'does-not-exist')
							.then(function (elements) {
								assert.deepEqual(elements, []);
							});
					}
				};
			})(),

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
				strategies.suffixes.filter(function (suffix) { return suffix !== 'Id'; }),
				strategies.filter(function (strategy) { return strategy !== 'id'; })
			),

			// TODO: findDisplayed
			// TODO: waitForDeleted

			'#waitForDeleted convenience methods': createStubbedSuite(
				'waitForDeleted',
				'waitForDeletedBy_',
				strategies.suffixes,
				strategies
			),

			'#click': function () {
				if (!session.capabilities.mouseEnabled) {
					this.skip('mouse not enabled');
				}

				return session.get(require.toUrl('./data/pointer.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return element.click();
				}).then(function () {
					return session.execute('return result;');
				}).then(function (result) {
					assert.isArray(result.mousedown.a);
					assert.isArray(result.mouseup.a);
					assert.isArray(result.click.a);
					assert.lengthOf(result.mousedown.a, 1);
					assert.lengthOf(result.mouseup.a, 1);
					assert.lengthOf(result.click.a, 1);
				});
			},

			'#submit (submit button)': function () {
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.getCurrentUrl();
				}).then(function (expectedUrl) {
					return session.findById('input').then(function (element) {
						return element.type('hello');
					}).then(function () {
						return session.findById('submit2');
					}).then(function (element) {
						return element.submit();
					}).then(function () {
						return session.getCurrentUrl();
					}).then(function (url) {
						expectedUrl += '?a=hello&go=submit2';
						assert.strictEqual(url, expectedUrl);
					});
				});
			},

			'#submit (form)': function () {
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.getCurrentUrl();
				}).then(function (expectedUrl) {
					return session.findById('input').then(function (element) {
						return element.type('hello');
					}).then(function () {
						return session.findById('form');
					}).then(function (element) {
						return element.submit();
					}).then(function () {
						return session.getCurrentUrl();
					}).then(function (url) {
						expectedUrl += '?a=hello';
						assert.strictEqual(url, expectedUrl);
					});
				});
			},

			'#getVisibleText': function () {
				return session.get(require.toUrl('./data/elements.html')).then(function () {
					return session.findById('c3');
				}).then(function (element) {
					return element.getVisibleText();
				}).then(function (text) {
					assert.strictEqual(text, 'What a cute backpack.');
				});
			},

			'#getVisibleText (multi-line)': function () {
				return session.get(require.toUrl('./data/elements.html')).then(function () {
					return session.findById('i4');
				}).then(function (element) {
					return element.getVisibleText();
				}).then(function (text) {
					var expectedText = [
						'I\'ve come up with another wacky invention that I think has real potential.',
						'Maybe you won\'t, but anyway...',
						'it\'s called the \u201cGourmet Yogurt Machine.\u201d',
						'It makes many different flavors of yogurt.',
						'The only problem is, right now, it can only make trout-flavored yogurt...',
						'So, I\'m having the machine delivered to you via Escargo Express.',
						'It\'s coming \u201cNeglected Class.\u201d'
					].join('\n');
					assert.strictEqual(text, expectedText);
				});
			},

			'#type': function () {
				// TODO: Complex characters, tabs and arrows, copy and paste
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('input');
				}).then(function (element) {
					return element.type('hello, world').then(function () {
						return element.getProperty('value');
					});
				}).then(function (value) {
					assert.strictEqual(value, 'hello, world');
				});
			},

			'#type -> file upload': function () {
				if (!session.capabilities.remoteFiles || session.capabilities.brokenFileSendKeys) {
					this.skip('Remote file uploads not supported by server');
				}

				return session.get(require.toUrl('./data/upload.html')).then(function () {
					return session.findById('file');
				}).then(function (element) {
					return element.type(require.toUrl('./data/upload.txt'));
				}).then(function () {
					/* global document:false */
					return session.execute(function () {
						var file = document.getElementById('file').files[0];
						return { name: file.name, size: file.size };
					});
				}).then(function (file) {
					assert.deepEqual(file, {
						name: 'upload.txt',
						size: 19
					});
				});
			},

			'#getTagName': function () {
				return session.get(require.toUrl('./data/default.html')).then(function () {
					return session.findByTagName('body');
				}).then(function (element) {
					return element.getTagName();
				}).then(function (tagName) {
					assert.strictEqual(tagName, 'body');
				});
			},

			'#clearValue': function () {
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('input2');
				}).then(function (element) {
					return element.getProperty('value').then(function (value) {
						assert.strictEqual(value, 'default');
						return element.clearValue();
					}).then(function () {
						return element.getProperty('value');
					});
				}).then(function (value) {
					assert.strictEqual(value, '');
				});
			},

			'#isSelected (radio button)': function () {
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('radio1');
				}).then(function (element) {
					return element.isSelected().then(function (isSelected) {
						assert.isTrue(isSelected, 'Default checked element should be selected');
						return session.findById('radio2').then(function (element2) {
							return element2.isSelected().then(function (isSelected) {
								assert.isFalse(isSelected, 'Default unchecked element should not be selected');
								return element2.click();
							}).then(function () {
								return element.isSelected();
							}).then(function (isSelected) {
								assert.isFalse(isSelected, 'Newly unchecked element should not be selected');
								return element2.isSelected();
							}).then(function (isSelected) {
								assert.isTrue(isSelected, 'Newly checked element should be selected');
							});
						});
					});
				});
			},

			'#isSelected (checkbox)': {
				setup: function () {
					resetBrowserState = false;
					return session.get(require.toUrl('./data/form.html'));
				},

				teardown: function () {
					resetBrowserState = true;
				},

				'initial selection': function () {
					return session.findById('checkbox').then(function (element) {
						return element.isSelected();
					}).then(function (isSelected) {
						assert.isFalse(isSelected, 'Default unchecked element should not be selected');
					});
				},

				'change selection': function () {
					return session.findById('checkbox').then(function (element) {
						return element.click().then(function () {
							return element.isSelected();
						}).then(function (isSelected) {
							assert.isTrue(isSelected, 'Newly checked element should be selected');
							return element.click();
						}).then(function () {
							return element.isSelected();
						}).then(function (isSelected) {
							assert.isFalse(isSelected, 'Newly unchecked element should not be selected');
						});
					});
				}
			},

			'#isSelected (drop-down)': {
				setup: function () {
					resetBrowserState = false;
					return session.get(require.toUrl('./data/form.html'));
				},

				teardown: function () {
					resetBrowserState = true;
				},

				'initial selection': function () {
					return session.findById('option2').then(function (element) {
						return element.isSelected();
					}).then(function (isSelected) {
						assert.isTrue(isSelected, 'Default selected element should be selected');
					}).then(function () {
						return session.findById('option1');
					}).then(function (element) {
						return element.isSelected();
					}).then(function (isSelected) {
						assert.isFalse(isSelected, 'Default unselected element should not be selected');
					});
				},

				'change selection': function () {
					if (session.capabilities.brokenOptionSelect) {
						this.skip('broken option select');
					}

					return session.findById('select').then(function (select) {
						return select.click();
					}).then(function () {
						return session.findById('option1');
					}).then(function (element) {
						return element.click()
							.then(function () {
								return element.isSelected();
							}).then(function (isSelected) {
								assert.isTrue(isSelected, 'Newly selected element should be selected');
							});
					}).then(function () {
						return session.findById('option2');
					}).then(function (element) {
						return element.isSelected();
					}).then(function (isSelected) {
						assert.isFalse(isSelected, 'Newly unselected element should not be selected');
					});
				}
			},

			'#isEnabled': function () {
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('input');
				}).then(function (element) {
					return element.isEnabled();
				}).then(function (isEnabled) {
					assert.isTrue(isEnabled);
					return session.findById('disabled');
				}).then(function (element) {
					return element.isEnabled();
				}).then(function (isEnabled) {
					assert.isFalse(isEnabled);
				});
			},

			'#getSpecAttribute': function () {
				/*jshint maxlen:140 */
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('input2');
				}).then(function (element) {
					return element.getSpecAttribute('value').then(function (value) {
						assert.strictEqual(value, 'default', 'Default value of input should be returned when value is unchanged');
						return element.type('foo');
					}).then(function () {
						return element.getSpecAttribute('value');
					}).then(function (value) {
						assert.strictEqual(value, 'defaultfoo', 'Current value of input should be returned');
						return element.getSpecAttribute('defaultValue');
					}).then(function (defaultValue) {
						assert.strictEqual(defaultValue, 'default', 'Default value should be returned');
						return element.getSpecAttribute('data-html5');
					}).then(function (value) {
						assert.strictEqual(value, 'true', 'Value of custom attributes should be returned');
						return element.getSpecAttribute('nonexisting');
					}).then(function (value) {
						assert.isNull(value, 'Non-existing attributes should not return a value');
					});
				}).then(function () {
					return session.findById('disabled');
				}).then(function (element) {
					return element.getSpecAttribute('disabled');
				}).then(function (isDisabled) {
					assert.strictEqual(isDisabled, 'true', 'True boolean attributes must return string value per the spec');
					return session.get(require.toUrl('./data/elements.html'));
				}).then(function () {
					return session.findById('c');
				}).then(function (element) {
					return element.getSpecAttribute('href');
				}).then(function (href) {
					return session.getCurrentUrl().then(function (baseUrl) {
						var expected = baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1) + 'default.html';
						assert.strictEqual(href, expected, 'Link href value should be absolute');
					});
				});
			},

			'#getAttribute': function () {
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('form');
				}).then(function (element) {
					return element.getAttribute('action');
				}).then(function (action) {
					assert.strictEqual(action, 'form.html');
					return session.findById('disabled');
				}).then(function (element) {
					return Promise.all({
						'non-existing': element.getAttribute('non-existing'),
						disabled: element.getAttribute('disabled')
					});
				}).then(function (result) {
					assert.isNotNull(result.disabled);
					assert.isNull(result['non-existing']);
				});
			},

			'#getProperty': function () {
				return session.get(require.toUrl('./data/form.html')).then(function () {
					return session.findById('form');
				}).then(function (element) {
					return element.getProperty('action');
				}).then(function (action) {
					assert.operator(action.indexOf('http'), '===', 0);
					return session.findById('disabled');
				}).then(function (element) {
					return Promise.all({
						'non-existing': element.getProperty('non-existing'),
						disabled: element.getProperty('disabled')
					});
				}).then(function (result) {
					assert.isTrue(result.disabled);
					assert.isNull(result['non-existing']);
				});
			},

			'#equals': function () {
				return session.get(require.toUrl('./data/elements.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return session.findById('z').then(function (element2) {
						return element.equals(element2).then(function (isEqual) {
							assert.isFalse(isEqual);
							return element2.equals(element);
						}).then(function (isEqual) {
							assert.isFalse(isEqual);
						});
					}).then(function () {
						return session.findById('a');
					}).then(function (element2) {
						return element.equals(element2).then(function (isEqual) {
							assert.isTrue(isEqual);
							return element2.equals(element);
						}).then(function (isEqual) {
							assert.isTrue(isEqual);
						});
					});
				});
			},

			'#isDisplayed': (function () {
				var visibilities = {
					normal: true,
					empty: false,
					invisible: false,
					visibleChild: true,
					noDisplay: false,
					noOpacity: false,
					offscreen: false,
					scrolledAway: true
				};

				var suite = {
					setup: function () {
						resetBrowserState = false;
						return session.get(require.toUrl('./data/visibility.html'));
					},
					teardown: function () {
						resetBrowserState = true;
					}
				};

				for (var id in visibilities) {
					(function (id, expected) {
						suite[id] = function () {
							return session.findById(id).then(function (element) {
								return element.isDisplayed();
							}).then(function (isDisplayed) {
								assert.strictEqual(isDisplayed, expected);
							});
						};
					})(id, visibilities[id]);
				}

				return suite;
			})(),

			'#getPosition': (function () {
				// TODO: Inside scrolled viewport
				// TODO: Fix transforms for platforms without transforms

				var positions = {};
				positions.a = { x: 0, y: 2000 };
				positions.b = { x: 100, y: 2322 };
				positions.c = { x: 20, y: positions.b.y + 130 };
				positions.d = { x: positions.c.x + 350, y: positions.c.y + 80 };
				positions.e = { x: 13, y: 2445 };
				positions.f = { x: 0, y: 2472 };

				var suite = {
					setup: function () {
						resetBrowserState = false;
						return session.get(require.toUrl('./data/dimensions.html'));
					},
					teardown: function () {
						resetBrowserState = true;
					}
				};

				for (var id in positions) {
					(function (id, expected) {
						suite[id] = function () {
							return session.findById(id).then(function (element) {
								return element.getPosition();
							}).then(function (position) {
								assert.deepEqual(position, expected);
							});
						};
					})(id, positions[id]);
				}

				return suite;
			})(),

			'#getSize': (function () {
				var documentWidth;
				var dimensions = {};
				dimensions.a = { width: 222, height: 222 };
				dimensions.b = { width: 10, height: 10 };
				dimensions.c = { width: -1, height: 0 };
				dimensions.d = { width: 80, height: 40 };
				dimensions.e = { width: 20, height: 20 };
				dimensions.f = { width: -1, height: 0 };

				var suite = {
					setup: function () {
						resetBrowserState = false;
						return session.get(require.toUrl('./data/dimensions.html')).then(function () {
							return session.execute('return document.body.offsetWidth;');
						}).then(function (width) {
							documentWidth = width;
						});
					},
					teardown: function () {
						resetBrowserState = true;
					}
				};

				for (var id in dimensions) {
					(function (id, expected) {
						suite[id] = function () {
							return session.findById(id).then(function (element) {
								return element.getSize();
							}).then(function (dimensions) {
								if (expected.width === -1) {
									expected.width = documentWidth;
								}
								else if (id === 'e' && !session.capabilities.supportsCssTransforms) {
									expected.width = expected.height = 40;
								}

								assert.deepEqual(dimensions, expected);
							});
						};
					})(id, dimensions[id]);
				}

				return suite;
			})(),

			'#getComputedStyle': function () {
				/*jshint maxlen:140 */

				// TODO: Spec: pseudo-elements?
				return session.get(require.toUrl('./data/dimensions.html')).then(function () {
					return session.findById('a');
				}).then(function (element) {
					return element.getComputedStyle('backgroundColor').then(function (style) {
						assert.strictEqual(style, 'rgba(128, 0, 128, 1)', 'Background colour should be rgba');
						return element.getComputedStyle('borderLeftWidth');
					}).then(function (style) {
						assert.strictEqual(style, '1px', 'Left border width should be in pixels');
						return element.getComputedStyle('display');
					}).then(function (style) {
						assert.strictEqual(style, 'block', 'Display mode should be the correct non-overridden style');
						return element.getComputedStyle('notAProperty');
					}).then(function (style) {
						// Empty string is used by necessity since this is what FirefoxDriver returns and we cannot
						// list all possible invalid style names
						assert.strictEqual(style, '', 'Non-existing style should not return any value');
					});

					// TODO: Firefox thinks these are inapplicable; see https://bugzilla.mozilla.org/show_bug.cgi?id=889091
					/*
						return element.getComputedStyle('borderWidth');
					}).then(function (style) {
						assert.strictEqual(style, '1px', 'Border width should be in pixels');
						return element.getComputedStyle('border');
					}).then(function (style) {
						assert.strictEqual(style, '1px solid rgba(0, 0, 0, 1)', 'Composite border should be in order size, style, colour');
					});
					*/
				});
			}
		};
	});
});
