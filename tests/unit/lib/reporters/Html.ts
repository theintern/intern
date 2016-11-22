define([
	'intern!object',
	'intern/chai!assert',
	'../../../../lib/Suite',
	'../../../../lib/Test',
	'../../../../lib/reporters/Html',
	'../../../../lib/util'
], function (registerSuite, assert, Suite, Test, Html, util) {
	var createdNodes;

	var doc = {
		createElement: function () {
			var elem = document.createElement.apply(document, arguments);
			createdNodes.push(elem);
			return elem;
		},
		createTextNode: function () {
			var elem = document.createTextNode.apply(document, arguments);
			createdNodes.push(elem);
			return elem;
		},
		createDocumentFragment: function () {
			return document.createDocumentFragment();
		},
		body: document.body
	};

	registerSuite({
		name: 'intern/lib/reporters/Html',

		beforeEach: function () {
			createdNodes = [];
		},

		afterEach: function () {
			createdNodes.forEach(function (node) {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			});
			createdNodes = null;
		},

		suiteStart: function () {
			var suite = {
				parent: {},
				tests: [ {} ],
				name: 'foo',
				id: 'foo'
			};

			// Check that the reporter isn't doing anything with the DOM that target browsers can't handle
			assert.doesNotThrow(function () {
				var reporter = new Html({ document: doc });
				reporter.run();
				reporter.suiteStart(suite);
			});
		}
	});
});
