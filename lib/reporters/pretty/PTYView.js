define([ 'dojo/node!charm', './StatusBar', './Results' ], function (charm, ProgressBar, Results) {
	// tests/selftest.intern
	// Total: [✔︎~✔︎✔︎×✔︎/             ]  32/100
	// Passed: 30   Failed: 1    Skipped: 1
	function PTYView() {
		this._sessions = {};

		// create the root session
		this.createSession();
	}

	PTYView.prototype = {
		start: function () {
			this.charm = charm();
			this.charm.pipe(process.stdout);
		},

		displayResults: function (results) {
			var progressBar = new ProgressBar(this.charm, results);
			this.charm.write('Total: [');
			progressBar.render();
			console.log('] %d/%d', results.complete, results.total);
			console.log('Passed: %d  Failed: %d  Skipped: %d', results.passed, results.failed, results.skipped);
		},

		createSession: function () {
		},

		getSession: function () {
		}
	};

	return PTYView;
});