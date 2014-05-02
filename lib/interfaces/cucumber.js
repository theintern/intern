define([
	'../Suite',
	'../Test',
	'../../main',
	'dojo/aspect',
	'require',
	'dojo/topic',
	'dojo/Deferred',
	'dojo/has!host-node?dojo/node!fs:dojo/request',
	'cucumber'
], function (Suite, Test, main, aspect, require, topic, Deferred, requestor, Lexer) {
	var cucumber = window.Cucumber;

	function getTest(suite, testName) {
		for (var i = 0; i < suite.tests.length; i++) {
			if (suite.tests[i].name === testName) {
				return suite.tests[i];
			}
		}
	}

	function createListener(suite) {
		var test;

		return {
			hear: function hear(event, callback) {
				var scenario, finished, step, stepResult;

				try {
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
								if (!test.hasPassed && !test.hasBeenProcessed) {
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

						case 'BeforeStep':
							// no intern equivalent
							break;

						case 'AfterStep':
							// no intern equivalent
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
								else if (stepResult.isSkipped()) {
									step = stepResult.getStep();
									test.error = { message: 'Step "' + step.getName() + '" was skipped' };
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
				} catch (e) {
					console.error('Cucumber error:', e);
					console.error(e.stack);
					callback(e);
				}
			}
		};
	}

	function createSuite(featureSource, support, parentSuite) {
		function wrapSupportFunction(support) {
			return function () {
				// add Intern-specific things to the world
				this.World = function (callback) {
					// add remote for functional tests
					if (suite.remote) {
						this.remote = suite.remote;
					}

					// add an 'assert' convenience method to make it easier to use chai assertions with the cucumber
					// callback
					this.assert = function (cb, assertionFunc) {
						try {
							assertionFunc.call(this);
							cb();
						} catch (e) {
							cb.fail(e.message);
						}
					};

					callback();
				};

				support.call(this);
			};
		}

		var runner = cucumber(featureSource, wrapSupportFunction(support)),
			suite = new Suite({
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
			}),
			lexer = new Lexer({
				comment: function () {}, 
				tag: function () {},
				background: function () {},
				step: function () {},
				doc_string: function () {},
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
				examples: function () {},
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
				},
				eof: function () {}
			});

		// fill in the suite's name and tests by lexing the feature source
		lexer.scan(featureSource);

		runner.attachListener(createListener(suite));
		parentSuite.tests.push(suite);
	}

	function registerSupport(support, featureSource) {
		main.suites.forEach(function (suite) {
			createSuite(featureSource, support, suite);
		});
	}

	/**
	 * AMD plugin API interface for easy loading of cucumber feature files.
	 */
	registerSupport.load = function (feature, parentRequire, callback) {
		if (!/.*\.feature$/.test(feature)) {
			feature = feature + '.feature';
		}

		if (requestor.readFile) {
			requestor.readFile(feature, function (err, featureSource) {
				if (err) {
					throw Error('Unable to load feature from ' + feature);
				}
				featureSource = featureSource.toString('utf-8');
				callback(function (support) {
					registerSupport(support, featureSource);
				});
			});
		} else {
			requestor.get(require.toUrl(feature)).then(function (featureSource) {
				callback(function (support) {
					registerSupport(support, featureSource);
				});
			});
		}
	};

	return registerSupport;
});
