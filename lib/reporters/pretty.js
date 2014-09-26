/**
 * Handles presentation of runner results to the user
 */
define([
	'dojo/Deferred',
	'dojo/node!charm',
	'./pretty/RemoteRenderer',
	'./pretty/ClientRenderer',
	'../util',
	'dojo/node!util',
	'dojo/has!host-node?dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (Deferred, charm, RemoteRenderer, ClientRenderer, internUtil, nodeUtil, Collector, Reporter) {
	/* globals process */

	function isRootSuite(suite) {
		return suite.name && suite.name === 'main' && !suite.parent;
	}

	function PrettyReporter() {
		this.ttySupport = process.stdout.isTTY;
		this.charm = null;
		this._renderers = {};
		this._rendererList = [];
		this._coverage = new Collector();
		this._lastProgressHeight = 0;
		this._lastNumDisplayedTests = 0;
		this._lastRenderTime = 0;
		this._minRenderIntervalMs = 50;
		this._problemTests = [];
		this._oldDeferredInstrumentation = null;

		// Since reporters are currently treated as singletons we need to bind our context
		for (var key in PrettyReporter.prototype) {
			var value = PrettyReporter.prototype[key];
			if (typeof value === 'function') {
				this[key] = value.bind(this);
			}
		}
	}

	PrettyReporter.prototype =  {
		constructor: PrettyReporter,

		start: function () {
			// HACK Disable Deferred instrumentation to prevent messing up the console
			this._oldDeferredInstrumentation = Deferred.instrumentRejected;
			Deferred.instrumentRejected = null;

			this.charm = charm();
			this.charm.pipe(process.stdout);
			if (this.ttySupport) {
				this.charm.reset();
			}
		},

		stop: function () {
			// clear the screen for TTYs
			if (this.ttySupport) {
				this.charm.reset();
			} else {
				// Add a line for readability
				this.charm.write('\n');
			}

			// Display verbose information about test failures and skips
			this._displayTestIssues(this._problemTests, 0, true);

			// Display coverage information
			(new Reporter()).writeReport(this._coverage, true);

			if (this.ttySupport) {
				this._renderProgress(true);
			}

			Deferred.instrumentRejected = this._oldDeferredInstrumentation;
		},

		destroy: function () {
			this.charm.destroy();
		},

		'/suite/new': function () {
			// NOTE this is where we could grab a list of all requested environments
		},

		'/suite/start': function (suite) {
			if (isRootSuite(suite)) {
				var sessionId = suite.sessionId || '';
				var renderers = this._renderers[sessionId];

				// Renders have previously been added and the second [functional] suite is starting
				if (renderers) {
					renderers[0].numTests = suite.numTests;
					return;
				}

				// If a suite has a session its a remote suite
				if (sessionId) {
					var env = suite.remote && suite.remote.environmentType;
					renderers = this._renderers[sessionId] = [
						new RemoteRenderer(this.charm, 'UNIT'),
						new RemoteRenderer(this.charm, 'FUNC', env, suite.numTests)
					];
					this._rendererList.push(renderers[1], renderers[0]);
				}
				// This is a client renderer
				else {
					renderers = this._renderers[sessionId] = [
						new ClientRenderer(this.charm, suite.numTests)
					];
					this._rendererList.push(renderers[0]);
				}

				renderers.forEach(function(renderer) {
					// Tag this renderer with the sessionId for easier identification during rendering
				    renderer.sessionId = sessionId;
				});
			}
		},

		'/suite/end': function (suite) {
			if (isRootSuite(suite)) {
				// Shift out the current suite making the next one active
				var sessionId = suite.sessionId || '';
				var renderers = this._renderers[sessionId];
				renderers.shift();

				this._render();
			}
		},

		'/test/pass': function (test) {
			var sessionId = test.sessionId || '';
			var renderer = this._renderers[sessionId][0];

			renderer.recordPassed();
			this.ttySupport && this._render();
		},

		'/test/skip': function (test) {
			var sessionId = test.sessionId || '';
			var renderer = this._renderers[sessionId][0];

			renderer.recordSkipped();
			this._problemTests.push(test);
			this.ttySupport && this._render();
		},

		'/test/fail': function (test) {
			var sessionId = test.sessionId || '';
			var renderer = this._renderers[sessionId][0];

			renderer.recordFailed();
			this._problemTests.push(test);
			this.ttySupport && this._render();
		},

		'/tunnel/start': function () {
			console.log('Starting tunnel...');
		},

		'/tunnel/status': function (tunnel, status) {
			console.log(status);
		},

		'/coverage': function (sessionId, coverage) {
			this._coverage.add(coverage);
		},

		'/deprecated': function (name, replacement, extra) {
			console.warn(name + ' is deprecated.' +
				(replacement ?
					' Use ' + replacement + ' instead.' :
					' Please open a ticket at https://github.com/theintern/intern/issues if you still require access ' +
					'to this command through the Command object.') +
				(extra ? ' ' + extra : '')
			);
		},

		'/error': function (error) {
			internUtil.logError(error);
		},

		'_render': function () {
			if (Date.now() - this._lastRenderTime < this._minRenderIntervalMs) {
				return;
			}

			this._renderProgress();
			this._renderWindow();
			this._lastRenderTime = Date.now();
		},

		/**
		 * Draw the progress to the screen
		 */
		'_renderProgress': function (force) {
			var i = 0;
			var pos = 0;
			var renderer;

			if (!force) {
				// Move through the list to where rendering starts
				while (i < this._rendererList.length && !(renderer = this._rendererList[i]).needsRender) {
					pos += renderer.height;
					i++;
				}

				// Move the cursor up to start rendering
				var moveUp = this._lastProgressHeight - pos + this._lastNumDisplayedTests;
				if (this.ttySupport && moveUp > 0) {
					this.charm.up(moveUp);
				}
			}

			for (;i < this._rendererList.length; i++) {
				renderer = this._rendererList[i];
				var renderingComplete = this._renderers[renderer.sessionId].length === 0;
				if ((force || renderer.needsRender) && (this.ttySupport || renderingComplete)) {
					renderer.render();
				}
				else if (this.ttySupport) {
					this.charm.down();
				}
				pos += renderer.height;
			}

			this._lastProgressHeight = pos;
		},

		/**
		 * Renders test skips and failures while tests are running
		 * @private
		 */
		_renderWindow: function () {
			if (!this.ttySupport) {
				return;
			}

			var numTestsToDisplay = Math.min(this._problemTests.length, process.stdout.rows - this._lastProgressHeight - 2);
			if (numTestsToDisplay > 0) {
				this.charm.erase('end').write('\n');
				this._displayTestIssues(this._problemTests, this._problemTests.length - numTestsToDisplay);
			}
			this._lastNumDisplayedTests = numTestsToDisplay + 1;
		},

		/**
		 * Displays detailed test result information at the end of a test run
		 * @param tests An array of tests
		 * @param i the starting index for the passed array (default 0)
		 * @param verbose if stack traces should be displayed (default false)
		 * @private
		 */
		_displayTestIssues: function (tests, i, verbose) {
			i = i || 0;

			for (; i < tests.length; i++) {
				var test = tests[i];
				if (test.skipped) {
					this.charm.write('SKIP: ' + test.id + ' (' + test.timeElapsed + 'ms)');
				} else if (test.error) {
					this.charm.foreground('red')
						.write('FAIL')
						.display('reset')
						.write(': ' + test.id + ' (' + test.timeElapsed + 'ms)\n');
					verbose && internUtil.logError(test.error);
				}
			}
		}
	};

	return new PrettyReporter();
});