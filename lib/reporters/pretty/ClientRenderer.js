/**
 * Draw the complete client results to the screen
 *
 *  Total: [✔︎~✔︎✔︎×✔︎/             ]  32/100
 * 	Passed: 30   Failed: 1    Skipped: 1
 */
define([ './StatusBar', './Results', 'dojo/node!util' ], function (StatusBar, Results, nodeUtil) {
	function ClientRenderer(charm, numTests) {
		this.charm = charm;
		this._results = new Results(numTests, 10);
		this._statusBar = new StatusBar(charm, this._results);
		this._dirty = true;
	}

	ClientRenderer.prototype = {
		constructor: ClientRenderer,

		get height() {
			return 2;
		},

		get needsRender() {
			return this._dirty;
		},

		recordPassed: function () {
			this._dirty = true;
			this._results.recordPassed();
		},

		recordSkipped: function () {
			this._dirty = true;
			this._results.recordSkipped();
		},

		recordFailed: function () {
			this._dirty = true;
			this._results.recordFailed();
		},

		render: function () {
			this.charm.write('Total: [');
			this._statusBar.render();
			this.charm.write(nodeUtil.format('] %d/%d\n', this._results.complete, this._results.total));
			this.charm.write(nodeUtil.format('Passed: %d  Failed: %d  Skipped: %d\n',
				this._results.passed, this._results.failed, this._results.skipped));
			this._dirty = false;
		}
	};

	return ClientRenderer;
});