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
], function (Suite, Test, main, aspect, require, topic, Deferred, requestor) {
	var cucumber = window.Cucumber;

	function createListener(suite) {
		var test, testStart;

		return {
			hear: function hear(event, callback) {
				var scenario, stepResult, feature;

				try {
					switch (event.getName()) {
						case 'BeforeFeature':
							feature = event.getPayloadItem('feature');
							suite.name = feature.getName();
							topic.publish('/suite/start', suite);
							break;

						case 'AfterFeature':
							topic.publish('/suite/end', suite);
							break;

						case 'BeforeScenario':
							// beforeEach
							scenario = event.getPayloadItem('scenario');
							testStart = new Date().getTime();
							test = new Test({ name: scenario.getName(), parent: suite, hasPassed: true });
							suite.tests.push(test);
							suite.numTests++;
							topic.publish('/test/start', test);
							break;

						case 'AfterScenario':
							// afterEach
							test.timeElapsed = new Date().getTime() - testStart;
							suite.numTests++;
							if (!test.hasPassed) {
								suite.numFailedTests++;
								topic.publish('/test/fail', test);
							}
							else {
								topic.publish('/test/pass', test);
							}
							topic.publish('/test/end', test);
							test = null;
							break;

						case 'BeforeStep':
							// no intern equivalent
							stepResult = event.getPayloadItem('stepResult');
							break;

						case 'AfterStep':
							// no intern equivalent
							stepResult = event.getPayloadItem('stepResult');
							break;

						case 'StepResult':
							// no intern equivalent
							stepResult = event.getPayloadItem('stepResult');

							if (stepResult.isSuccessful()) {
								// result = {status: 'passed'};
							} else if (stepResult.isPending()) {
								// result = {status: 'pending'};
							} else if (stepResult.isUndefined()) {
								// result = {status:'skipped'};
							} else if (stepResult.isSkipped()) {
								// result = {status:'skipped'};
							} else {
								test.error = stepResult.getFailureException();
								test.hasPassed = false;
							}
							break;
					}
					callback();
				} catch (e) {
					console.error('Cucumber error:', e);
					console.error(e.stack);
				}
			},

			handleAnyStep: function handleAnyStep(step) {
				console.log('  step:', step.getKeyword() + step.getName());
			}
		};
	}

	function createSuite(featureSource, support, parentSuite) {
		function wrapSupportFunction(support) {
			return function () {
				// add Intern-specific things to the world
				this.World = function (callback) {
					if (suite.remote) {
						this.remote = suite.remote;
					}
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
			});
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
