/**
 * Visualizes a StatusBar from Results
 * @see Results
 */
define([], function () {
	var PASSED_MARK = '\u2714';
	var SKIPPED_MARK = '~';
	var FAILED_MARK = 'x';
	var SPINNER = ['|', '/', '-', '\\'];

	function StatusBar(charm, results) {
		this.charm = charm;
		this._results = results;
		this._spinnerState = 0;
		this._characterRender = {
			pass: function () {
				this.charm.foreground('green').write(PASSED_MARK);
			}.bind(this),

			fail: function () {
				this.charm.foreground('red').write(FAILED_MARK);
			}.bind(this),

			skip: function () {
				this.charm.display('reset').write(SKIPPED_MARK);
			}.bind(this),

			pending: function () {
				this._spinnerState = (this._spinnerState + 1) % SPINNER.length;
				this.charm.display('reset').write(SPINNER[this._spinnerState]);
			}.bind(this)
		};
	}

	StatusBar.prototype = {
		render: function () {
			var max = this._results.numGroups;
			var i, renderer, groupStatus;

			for (i = 0; i < max; i++) {
				groupStatus = this._results.getGroupResult(i);
				renderer = this._characterRender[groupStatus];
				renderer();
				if (groupStatus === 'pending') {
					for (i++; i < max; i++) {
						this.charm.write(' ');
					}
				}
			}
			this.charm.display('reset');
		}
	};

	return StatusBar;
});