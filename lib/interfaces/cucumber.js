define([
	'../Suite',
	'../Test',
	'../../main',
	'dojo/aspect',
	'require',
	'dojo/topic',
	'dojo/Deferred',
	'dojo/has!host-node?dojo/node!fs:dojo/request',
	'cucumberjs'
], function (Suite, Test, main, aspect, require, topic, Deferred, requestor, Lexer) {
	var cucumber = window.Cucumber;

	// Retrieve a test, by name, from a given suite
	function getTest(suite, testName) {
		for (var i = 0; i < suite.tests.length; i++) {
			if (suite.tests[i].name === testName) {
				return suite.tests[i];
			}
		}
	}

	// Create a test listener that will publish relevant cucumber events on the Intern pub/sub hub
	function createListener(suite) {
		var test;

		return {
			hear: function hear(event, callback) {
				var scenario;
				var finished;
				var step;
				var stepResult;

				switch (event.getName()) {
					case 'BeforeFeature':
						topic.publish('/suite/start', suite);
						break;

					case 'AfterFeature':
						topic.publish('/suite/end', suite);
						break;

					case 'BeforeScenario':
						// beforeEach
						scenario = event.getPayloadItem('scenario');
						test = getTest(suite, scenario.getName());

						// BeforeScenario will be called more than once for a scenario outline test (once for each
						// example table row) -- make sure to only perform test startup actions once
						if (!test.startTime) {
							test.startTime = new Date().getTime();
							test.hasPassed = true;
							topic.publish('/test/start', test);
						}
						break;

					case 'AfterScenario':
						scenario = event.getPayloadItem('scenario');
						finished = false;

						if ('runCount' in test) {
							// A test with a runCount property is for a scenario outline; it's not done until it's run
							// rowCount times.
							test.runCount++;
							if (test.runCount === test.rowCount) {
								finished = true;
							}
						}
						else {
							// A test without a runCount property is a normal test, so it's finished
							finished = true;
						}

						if (finished) {
							test.timeElapsed = new Date().getTime() - test.startTime;
							if (!test.hasPassed) {
								suite.numFailedTests++;
								topic.publish('/test/fail', test);
							}
							else {
								topic.publish('/test/pass', test);
							}
							topic.publish('/test/end', test);
							test = null;
						}
						break;

					case 'StepResult':
						// no intern equivalent
						if (test.hasPassed) {
							stepResult = event.getPayloadItem('stepResult');

							if (stepResult.isFailed()) {
								step = stepResult.getStep();
								test.error = stepResult.getFailureException();
								test.error.message = 'Step "' + step.getName() + '" failed\n' + test.error.message;
								test.hasPassed = false;
							}
							else if (stepResult.isUndefined()) {
								step = stepResult.getStep();
								test.error = { message: 'Step "' + step.getName() + '" is undefined' };
								test.hasPassed = false;
							}
						}
						break;
				}

				callback();
			}
		};
	}

	// Create a test suite for a given feature file and set of support functions
	function createSuite(featureSource, support, parentSuite) {
		function wrapSupportFunction(support) {
			return function () {
				// add Intern-specific things to the world
				this.World = function (done) {
					// add remote for functional tests
					if (suite.remote) {
						this.remote = suite.remote;
					}

					// add an 'assert' convenience method to make it easier to use chai assertions with the cucumber
					// callback
					this.assert = function (callback, assertionFunc) {
						try {
							assertionFunc.apply(this, arguments);
							callback();
						}
						catch (error) {
							callback.fail(error.message);
						}
					};

					done();
				};

				support.call(this);
			};
		}

		// The cucumber runner is what actually drives the testing process
		var runner = cucumber(featureSource, wrapSupportFunction(support));

		// The Suite object simply kicks off the cucumber runner and resolves or rejects itself when the runner
		// completes.
		var suite = new Suite({
			parent: parentSuite,
			run: function () {
				var dfd = new Deferred();

				runner.start(function (succeeded) {
					if (succeeded) {
						dfd.resolve();
					}
					else {
						dfd.reject();
					}
				});

				return dfd.promise;
			}
		});

		// A cucumber lexer is used to create Intern Suite and Test objects for a feature file.
		var lexer = new Lexer({
			// These aren't currently relevant to Intern
			comment: /* istanbul ignore next */ function () {}, 
			tag: /* istanbul ignore next */ function () {},
			background: /* istanbul ignore next */ function () {},
			step: /* istanbul ignore next */ function () {},
			doc_string: /* istanbul ignore next */ function () {},
			examples: /* istanbul ignore next */ function () {},
			eof: /* istanbul ignore next */ function () {},

			// Intern cares about these
			feature: function (eventType, name) {
				suite.name = name;
			},
			scenario: function (eventType, name) {
				suite.tests.push(new Test({ name: name, parent: suite }));
				suite.numTests++;
			},
			scenario_outline: function (eventType, name) {
				this.outline = { name: name, rows: 0, seenHeading: false };
			},
			row: function () {
				if (!this.outline.seenHeading) {
					// first row we observe will be the heading row
					this.outline.seenHeading = true;
					this.outline.test = new Test({ name: this.outline.name, parent: suite, rowCount: 0, runCount: 0 });
					suite.tests.push(this.outline.test);
					suite.numTests++;
				}
				else {
					// every other row is an instance of the scenario
					this.outline.test.rowCount++;
				}
			}
		});

		// Build the Suite object
		lexer.scan(featureSource);
		runner.attachListener(createListener(suite));
		parentSuite.tests.push(suite);
	}

	/**
	 * Register a set of tests for the combination of a feature file and associated support functions.
	 */
	function registerSupport(support, featureSource) {
		main.suites.forEach(function (suite) {
			createSuite(featureSource, support, suite);
		});
	}

	/**
	 * AMD plugin API interface for easy loading of cucumber feature files.
	 */
	registerSupport.load = function (feature, parentRequire, callback) {
		function handleError(error) {
			callback(new Error('Unable to load feature from ' + feature + ': ' + error));
		}

		function handleSuccess(featureSource) {
			callback(function (support) {
				registerSupport(support, featureSource);
			});
		}

		if (!/.*\.feature$/.test(feature)) {
			feature = feature + '.feature';
		}

		// for node, use fs.readFile to load the feature file
		if (requestor.readFile) {
			requestor.readFile(feature, function (error, featureSource) {
				if (error) {
					handleError(error);
				}
				else {
					handleSuccess(featureSource.toString('utf-8'));
				}
			});
		}
		// for the browser, use Dojo's request.get
		else {
			requestor.get(require.toUrl(feature)).then(handleSuccess, handleError);
		}
	};

	return registerSupport;
});
