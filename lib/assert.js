define({
	isEqual: function (actual, expected, hint) {
		if (actual !== expected) {
			throw new Error('Assertion failed: ' + hint + ' (' + actual + ' !== ' + expected + ')');
		}
	}
});