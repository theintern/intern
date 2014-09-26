define([ 'dojo/node!charm', './StatusBar', './Results' ], function (charm, ProgressBar, Results) {
	// tests/selftest.intern
	// Total: [✔︎~✔︎✔︎×✔︎/             ]  32/100
	// Passed: 30   Failed: 1    Skipped: 1
	function PTYView(numTests) {
		this.numTests = numTests;
		this._results = new Results(numTests, 10);
		this._progressBar = null;
		this.maxWidth = 80;
	}

	PTYView.prototype = {
		start: function () {
			this.charm = charm();
			this.charm.pipe(process.stdout);
			this.charm.reset();

			this._progressBar = new ProgressBar(this.charm, this._results);
			this.charm.write('Total: [          ] 0/' + this.numTests);
			this.charm.write('Passed: ##   Failed: ##   Skipped: ##');
		},

		testPassed: function () {
			this._result.recordPassed();
			this._progressBar.render();
		},

		testFailed: function () {
			this._result.recordFailed();
			this._progressBar.render();
		},

		testSkipped: function () {
			this._result.recordFailed();
			this._progressBar.render();
		}
	};

	return PTYView;
});