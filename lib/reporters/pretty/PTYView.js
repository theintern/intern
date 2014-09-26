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
			this.charm.display('reset')
			console.log('] %s/%s', results.complete, results.total);
//			this.charm.write('] /10\n');
			this.charm.write('Passed: ' + results.passed + '   Failed: ' + results.failed + '   Skipped: ' + results.skipped + '\n');
		},

		createSession: function () {
		},

		getSession: function () {
		}
	};

	return PTYView;
});