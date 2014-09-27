define([
	'dojo/node!charm',
	'./StatusBar',
	'dojo/node!util'
], function (charm, ProgressBar, nodeUtil) {
	var PAD = '                                                    ';

/* globals process */
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

		displayClientResults: function (results) {
			var progressBar = new ProgressBar(this.charm, results);

			this.charm.write('Total: [');
			progressBar.render();
			console.log('] %d/%d', results.complete, results.total);
			console.log('Passed: %d  Failed: %d  Skipped: %d', results.passed, results.failed, results.skipped);
		},

		displayFunctionalResults: function (unitResults, funcResults, browserName) {
			var title = nodeUtil.format('%s: ');
			var spacer = PAD.slice(0, title.length);
			this._displaySingleLineFunctional(unitResults, title);
			this._displaySingleLineFunctional(funcResults, spacer);
		},
		
		_displaySingleLineFunctional: function (results, title) {
			var progressBar = new ProgressBar(this.charm, results);

			this.charm.write(nodeUtil.format('%s [', title));
			progressBar.render();
			this.charm.write(nodeUtil.format('] %d/%d', results.complete, results.progress));
			if(results.fail) {
				this.charm.write(nodeUtil.format(', %d fail', results.failed));
			}
			if(results.skip) {
				this.charm.write(nodeUtil.format(', %d skip', results.skipped));
			}
			this.charm.write('\n');
		},

		createSession: function () {
		},

		getSession: function () {
		}
	};

	return PTYView;
});