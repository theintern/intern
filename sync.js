define([
	'./lib/util',
	'dojo/Deferred'
], function (util, Deferred) {
	var queue = util.createQueue(1);

	return {
		/**
		 * AMD plugin API interface for in-order loading of module dependencies
		 */
		load: function (id, parentRequire, callback) {
			queue(function () {
				var dfd = new Deferred();

				parentRequire([id], function (value) {
					callback(value);
					dfd.resolve();
				});

				return dfd;
			})();
		}
	};
});