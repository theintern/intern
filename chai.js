define([ './assert' ], function (assert) {
	return {
		/**
		 * AMD plugin API interface for easy loading of chai assertion interfaces.
		 */
		load: function (id, parentRequire, callback) {
			if (id !== 'assert' && id !== 'config') {
				throw new Error('Invalid chai interface "' + id +
					'" (only "assert" and "config" are available in geezer)');
			}

			if (id === 'assert') {
				callback(assert);
			}
			else {
				callback(assert.config);
			}
		}
	};
});
