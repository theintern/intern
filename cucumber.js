define([
	'cucumber',
	'dojo/Deferred',
	'dojo/node!fs'
], function (Lexer, Deferred, fs) {
	var cucumber = window.Cucumber;
	// var SuiteBuilder = {
	// 	/**
 		 // * arguments:
	// 	 *   keyword [string]     - event keyword ("feature", "step", etc.)
	// 	 *   name [string]        - item name/title
	// 	 *   description [string] - description (if provided)
	// 	 *   lineNumber [number]  - line number where item starts
 		 // */
	// 	background: function () {
	// 		console.log('background:', arguments);
	// 	},
		
	// 	/**
 		 // * arguments:
 		 // * content [string]    - comment content
	// 	 * lineNumber [number] - line number where comment starts
 		 // */
	// 	comment: function () {
	// 		console.log('comment:', arguments);
	// 	},
		
	// 	/**
	// 	 * arguments:
	// 	 *   keyword [string]    - ''
	// 	 *   contents [string]   - doc string contents
	// 	 *   lineNumber [number] - doc string contents
 		 // */
	// 	doc_string: function (keyword, contents) {
	// 		console.log('doc:', contents);
	// 	},
		
	// 	/**
	// 	 * Indicates end of feature file
 		 // */
	// 	eof: function () {
	// 		console.log('<<eof>>');
	// 	},

	// 	/**
	// 	 * arguments:
	// 	 *   keyword [string]     - event keyword ("feature", "step", etc.)
	// 	 *   name [string]        - item name/title
	// 	 *   description [string] - description (if provided)
	// 	 *   lineNumber [number]  - line number where item starts
 		 // */
	// 	examples: function () {
	// 		console.log('example:');
	// 	},
		
	// 	/**
	// 	 * A test suite
	// 	 *
	// 	 * arguments:
	// 	 *   keyword [string]     - event keyword ("feature", "step", etc.)
	// 	 *   name [string]        - item name/title
	// 	 *   description [string] - description (if provided)
	// 	 *   lineNumber [number]  - line number where item starts
 		 // */
	// 	feature: function (keyword, name) {
	// 		console.log('feature:', name);
	// 	},
		
	// 	/**
	// 	 * Example row
	// 	 * arguments:
	// 	 *   contents [string]   - array of row cell contents
	// 	 *   lineNumber [number] - line number where row starts
 		 // */
	// 	row: function () {
	// 		console.log('row:', arguments);
	// 	},
		
	// 	/**
	// 	 * A test
 		 // *
	// 	 * arguments:
	// 	 *   keyword     - event keyword ("feature", "step", etc.)
	// 	 *   name        - item name/title
	// 	 *   description - description (if provided)
	// 	 *   lineNumber  - line number where item starts
	// 	 */
	// 	scenario: function (keyword, name) {
	// 		console.log('scenario:', name);
	// 	},
		
	// 	/**
	// 	 * A parameterized test
 		 // *
	// 	 * arguments:
	// 	 *   keyword     - event keyword ("feature", "step", etc.)
	// 	 *   name        - item name/title
	// 	 *   description - description (if provided)
	// 	 *   lineNumber  - line number where item starts
 		 // */
	// 	scenario_outline: function (keyword, name) {
	// 		console.log('scenario_outline:', name);
	// 	},

	// 	/**
	// 	 * arguments:
	// 	 *   keyword  - "And ", "When ", etc.
	// 	 *   string   - step string
 		 // */
	// 	step: function (keyword, string) {
	// 		console.log('step:', keyword + string);
	// 	},
		
	// 	/**
	// 	 * arguments:
	// 	 *   name       - tag name, e.g. "@foo"
	// 	 *   lineNumber - line number of tag
 		 // */
	// 	tag: function () {
	// 		console.log('tag:', arguments);
	// 	}
	// };

	var listener = function() {
		var currentStep;

		var self = {
			hear: function hear(event, callback) {
				var eventName = event.getName();
				console.log('event:', eventName);
				switch (eventName) {
					case 'BeforeFeature':
						var feature = event.getPayloadItem('feature');
						console.log('feature:', feature.getKeyword());
						// formatter.feature({
						// 	keyword     : feature.getKeyword(),
						// 	name        : feature.getName(),
						// 	line        : feature.getLine(),
						// 	description : feature.getDescription()
						// });
						break;

					case 'BeforeScenario':
						var scenario = event.getPayloadItem('scenario');
						console.log('scenario:', scenario.getKeyword());
						// formatter.scenario({
						// 	keyword     : scenario.getKeyword(),
						// 	name        : scenario.getName(),
						// 	line        : scenario.getLine(),
						// 	description : scenario.getDescription()
						// });
						break;

					case 'BeforeStep':
						var step = event.getPayloadItem('step');
						self.handleAnyStep(step);
						break;

					case 'StepResult':
						var stepResult = event.getPayloadItem('stepResult');
						console.log('step result:', stepResult.isSuccessful());
						// var result;
						// if (stepResult.isSuccessful()) {
						// 	result = {status: 'passed'};
						// } else if (stepResult.isPending()) {
						// 	result = {status: 'pending'};
						// } else if (stepResult.isUndefined() || stepResult.isSkipped()) {
						// 	result = {status:'skipped'};
						// } else {
						// 	var error = stepResult.getFailureException();
						// 	var errorMessage = error.stack || error;
						// 	result = {status: 'failed', error_message: errorMessage};
						// }
						break;
				}
				callback();
			},

			handleAnyStep: function handleAnyStep(step) {
				console.log('step:', step.getKeyword());
				// formatter.step({
				// 	keyword: step.getKeyword(),
				// 	name   : step.getName(),
				// 	line   : step.getLine(),
				// });
				currentStep = step;
			}
		};
		return self;
	};

	return {
		/**
		 * AMD plugin API interface for easy loading of chai assertion interfaces.
		 */
		load: function (feature, parentRequire, callback) {
			if (!/.*\.feature$/.test(feature)) {
				feature = feature + '.feature';
			}

			fs.readFile(feature, function (err, featureSource) {
				featureSource = featureSource.toString('utf-8');
				//var cuke = new Lexer(SuiteBuilder);
				//cuke.scan(featureSource);
				
				function registerFeature(kwArgs) {
					var runner = cucumber(featureSource, function () {
						console.log('getting help from', kwArgs);
					});
					runner.attachListener(listener());
					runner.start(function () {
						console.log('called:', arguments);
					});
				}

				callback(registerFeature);
			});
		}
	};
});
