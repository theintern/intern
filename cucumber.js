define([
	'cucumber',
	'dojo/Deferred',
	'dojo/node!fs'
], function (Cucumber, Deferred, fs) {
	var listener = {
		comment: function () {
			console.log('comment:', arguments);
		},
		
		tag: function () {
			console.log('tag:', arguments);
		},
		
		feature: function () {
			console.log('feature:', arguments);
		},
		
		background: function () {
			console.log('background:', arguments);
		},
		
		scenario: function () {
			console.log('scenario:', arguments);
		},
		
		scenario_outline: function () {
			console.log('scenario_outline:', arguments);
		},
		
		examples: function () {
			console.log('examples:', arguments);
		},
		
		step: function () {
			console.log('step:', arguments);
		},
		
		doc_string: function () {
			console.log('step:', arguments);
		},
		
		row: function () {
			console.log('row:', arguments);
		},
		
		eof: function () {
			console.log('eof:', arguments);
		}
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
				var cuke = new Cucumber(listener);
				cuke.scan(featureSource);

				callback(cuke);
			});
		}
	};
});
