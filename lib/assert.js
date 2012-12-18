define([], function () {
	// TODO: This assertion library sucks, replace it with a real one

	function arrayIsEqual(actual, expected) {
		if (actual.length !== expected.length) {
			return false;
		}

		for (var i = 0, j = actual.length; i < j; ++i) {
			if (actual[i] !== expected[i]) {
				return false;
			}
		}

		return true;
	}

	return {
		isEqual: function (actual, expected, hint) {
			if (actual !== expected) {
				throw new Error('Assertion failed: ' + hint + ' (' + actual + ' !== ' + expected + ')');
			}
		},
		is: function (actual, expected, hint) {
			if (Array.isArray(actual) && Array.isArray(expected)) {
				if (!arrayIsEqual(actual, expected)) {
					throw new Error('Assertion failed: ' + hint);
				}
			}
		}
	};
});