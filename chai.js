define([ './assert' ], function (assert) {
	return {
		/**
		 * AMD plugin API interface for easy loading of chai assertion interfaces.
		 */
		load: function (id, parentRequire, callback) {
			if (id !== 'assert') {
				throw new Error('Invalid chai interface "' + id + '" (only "assert" is available in geezer)');
			}

			callback(assert);
		}
	};
});
