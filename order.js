define([
	'./lib/util',
	'dojo/Deferred'
], function (util, Deferred) {
	var queue = util.createQueue(1);

	return {
		/**
		 * AMD plugin for in-order loading of non-AMD JavaScript. Use this when you need to test modules that do not
		 * have proper dependency management.
		 *
		 * @example
		 * define([ 'intern!object', 'intern/order!jquery.js', 'intern/order!plugin.jquery.js', ... ], ...)
		 */
		load: function (id, parentRequire, callback) {
			queue(function () {
				var dfd = new Deferred();

				parentRequire([ id ], function (value) {
					callback(value);
					dfd.resolve();
				});

				return dfd;
			})();
		},

		normalize: function (id, normalize) {
			return normalize(id.replace(/\.js$/, ''));
		}
	};
});
