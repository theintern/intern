define([ 'require', './lib/Suite' ], function (require, Suite) {
	var main = new Suite({ name: 'main' });

	main.load = function (id, parentRequire, callback) {
		require([ './lib/interfaces/' + id ], callback);
	};

	return main;
});