define([
	'dojo/aspect',
	'dojo/Promise',
	'require',
	'../../main',
	'../Suite',
	'../Test',
  'dojo/has!host-node?dojo/node!fs:dojo/request',
	'intern/browser_modules/cucumber/release/cucumber'
], function (aspect, Promise, require, main, Suite, Test, requestor, cucumber) {

	function createListener(suite) {
		var startTime, test;

		function report(suiteOrTest, eventName) {
			var reporterManager = suiteOrTest.reporterManager;
			if (reporterManager) {
				var args = [ eventName, suiteOrTest ].concat(Array.prototype.slice.call(arguments, 1));
				return reporterManager.emit.apply(reporterManager, args).catch(function() {});
			} else {
				return Promise.resolve();
			}
		}

		function stepKeyword(step) {
			while (step.hasRepeatStepKeyword()) {
				step = step.getPreviousStep();
			}
			return step.getKeyword();
		}

		return {
			hear: function hear(event, timeout, callback) {
				var feature, scenario, step, stepResult;

				try {
					var eventName = event.getName();
					console.log(eventName);
					switch (eventName) {
						case 'BeforeFeature':
							feature = event.getPayload();
							suite.name = feature.getName();
							report(suite, 'suiteStart');
							break;
						
						case 'AfterFeature':
							report(suite, 'suiteEnd');
							break;

						case 'BeforeScenario':
							// beforeEach
							scenario = event.getPayload();
							test = new Test({ name: scenario.getName(), parent: suite, hasPassed: true });
							suite.tests.push(test);
							suite.numTests++;
							startTime = Date.now();
							report(test, 'testStart');
							break;

						case 'AfterScenario':
							// afterEach
							test.timeElapsed = Date.now() - startTime;
							if (!test.hasPassed) {
								suite.numFailedTests++;
								report(test, 'testFail');
							} else {
								report(test, 'testPass');
							}
							report(test, 'testEnd');
							test = null;
							break;

						case 'BeforeStep':
							// no intern equivalent
							break;

						case 'AfterStep':
							// no intern equivalent
							break;

						case 'StepResult':
							if (test.hasPassed) {
								// TODO: skipped and other statusses
								stepResult = event.getPayload();
								var status = stepResult.getStatus();
								if (status === 'failed') {
									step = stepResult.getStep();
									test.error = stepResult.getFailureException();
									test.error.message = '"' + stepKeyword(step) + ' ' + step.getName() + '" failed: \n' + test.error.message;
									test.hasPassed = false;
								} else if (status === 'ambiguous') {
									test.error = new Error('ambiguous step definitions');
									test.hasPassed = false;
								}
							}
							break;
					}
					callback();
				} catch(e) {
					// TBD: how to do error reporting?
					console.error('Cucumber error:', e);
					console.error(e.stack);
				}
			}
		}
	}

	function registerSupport(featureSource, support) {
		main.executor.register(function(parentSuite) {
			var suite = new Suite({
				parent: parentSuite,
				run: function() {
					var runner = cucumber(featureSource, support);
					runner.attachListener(createListener(suite));
					return new Promise(function(resolve) {
						runner.start(resolve);
					});
				}
			});
			parentSuite.tests.push(suite);
		});
	};

	registerSupport.load = function(feature, parentRequire, callback) {
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
					registerSupport(featureSource, support);
				});
			});
		} else {
			requestor.get(require.toUrl(feature), { handleAs: 'text' }).then(function (featureSource) {
				callback(function (support) {
					registerSupport(featureSource.data, support);
				});
			});
		}
	};

	return registerSupport;
});
