define([
	'dojo/aspect',
	'dojo/Promise',
	'require',
	'../../main',
	'../Suite',
	'../Test',
	'dojo/has!host-node?dojo/node!fs:dojo/request',
	'cucumber'
], function (aspect, Promise, require, main, Suite, Test, requestor, cucumber) {

	function report(suiteOrTest, eventName) {
		var reporterManager = suiteOrTest.reporterManager;
		if (reporterManager) {
			var args = [ eventName, suiteOrTest ].concat(Array.prototype.slice.call(arguments, 1));
			return reporterManager.emit.apply(reporterManager, args).catch(function() {});
		} else {
			return Promise.resolve();
		}
	}

	function createListener(suite) {
		var startTime, test;

		function wrapError(error) {
			return typeof(error) === 'string' ? new Error(error) : error;
		}

		function stepKeyword(step) {
			while (step.hasRepeatStepKeyword()) {
				step = step.getPreviousStep();
			}
			return step.getKeyword();
		}

		function getAmbiguousErrorMessage(stepResult) {
			var message = 'Multiple step definitions match:' + '\n';
			var stepDefinitions = stepResult.getAmbiguousStepDefinitions();
			stepDefinitions.forEach(function(stepDefinition) {
				var pattern = stepDefinition.getPattern().toString();
				var line = stepDefinition.getLine();
				message += '  "' + pattern + '" on line ' + line + '\n';
			});
			return message;
		}

		return {
			hear: function hear(event, timeout, callback) {
				var feature, scenario, step, stepResult;

				try {
					var eventName = event.getName();
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
								var step = stepResult.getStep();
								var stepText = '"' + stepKeyword(step) + step.getName() + '"';
								if (status === cucumber.Status.FAILED) {
									step = stepResult.getStep();
									test.error = wrapError(stepResult.getFailureException());
									test.error.message = stepText + ' failed:\n' + test.error.message;
									test.hasPassed = false;
								} else if (status === cucumber.Status.AMBIGUOUS) {
									test.error = new Error(getAmbiguousErrorMessage(stepResult));
									test.hasPassed = false;
								} else if (status === cucumber.Status.UNDEFINED) {
									test.error = new Error(stepText + ' does not have a matching step definition');
									test.hasPassed = false;
								}
							}
							break;
					}
					callback();
				} catch(e) {
					suite.error = e;
					report(suite, 'suiteError').then(function() {
						throw e;
					});
				}
			}
		}
	}

	function wrapInitializers(stepDefinitionInitializers) {
		return function() {
			// The 'this' context refers to the Cucumber support initialization object.
			// Pass it as the 'this' context to every step definition function.
			stepDefinitionInitializers.forEach(function(stepDefinitionInitializer) {
				stepDefinitionInitializer.call(this);
			}, this);
		}
	}

	function registerCucumber(featureSource) {
		var stepDefinitionInitializers = Array.prototype.slice.call(arguments);
		stepDefinitionInitializers.shift(); // remove the featureSource
		main.executor.register(function(parentSuite) {
			var suite = new Suite({
				parent: parentSuite,
				run: function() {
					var runner = cucumber(featureSource, wrapInitializers(stepDefinitionInitializers));
					runner.attachListener(createListener(suite));
					return new Promise(function(resolve) {
						try {
							runner.start(resolve);
						} catch (e) {
							suite.error = e;
							report(suite, 'suiteError').then(resolve);
						}
					});
				}
			});
			parentSuite.tests.push(suite);
		});
	};

	return registerCucumber;
});
