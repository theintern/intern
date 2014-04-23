define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/object-utils'
], function (Collector, utils) {

	function reportErrors(sessionId, topic, failures) {
		failures.length && topic.publish('/coverage/error', sessionId, failures.join('\n'));
	}

	function checkCoverage(sessionId, topic, thresholds, collector) {
		var k, actual, actualUncovered, threshold, failures = [];
		var actuals = utils.summarizeCoverage(collector.getFinalCoverage());

		for (k in thresholds) {
			actual = actuals[k].pct,
			actualUncovered = actuals[k].total - actuals[k].covered;
			threshold = thresholds[k];
			if (threshold < 0) {
				if (threshold * -1 < actualUncovered) {
					failures.push('Uncovered count for ' + k + ' (' + actualUncovered + ') exceeds threshold (' + -1 * threshold + ')');
				}
			}
			else {
				if (actual < threshold) {
					failures.push('Coverage for ' + k + ' (' + actual + '%) does not meet threshold (' + threshold + '%)');
				}
			}
		}

		reportErrors(sessionId, topic, failures);
	}

	function runRemoteSession(topic, thresholds) {
		var sessions = {}, handles = [];

		handles.push(topic.subscribe('/session/start', function (remote) {
			sessions[remote.sessionId] = { remote: remote };
		}));

		handles.push(topic.subscribe('/session/end', function (remote) {
			var session = sessions[remote.sessionId];
			session.coverage && checkCoverage(remote.sessionId, topic, thresholds, session.coverage);
		}));

		handles.push(topic.subscribe('/coverage', function (sessionId, coverage) {
			var session = sessions[sessionId];
			session.coverage = session.coverage || new Collector();
			session.coverage.add(coverage);
		}));

		return {
			remove: function () {
				while (handles.length) {
					handles.pop().remove();
				}
			}
		};

	}

	function runLocalSession(topic, thresholds) {
		return topic.subscribe('/coverage', function (sessionId, coverage) {
			var collector = new Collector();
			collector.add(coverage);
			checkCoverage(sessionId, topic, thresholds, collector);
		});
	}

	return function (topic, options, isRemoteSesson) {
		var thresholds, handle;

		if (!options) {
			return;
		}

		thresholds = {
			statements: options.statements || 0,
			branches: options.branches || 0,
			lines: options.lines || 0,
			functions: options.functions || 0
		};

		if (isRemoteSesson) {
			handle = runRemoteSession(topic, thresholds);
		}
		else {
			handle = runLocalSession(topic, thresholds);
		}

		return handle;

	};

});
