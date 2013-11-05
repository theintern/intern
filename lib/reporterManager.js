define([
	'dojo/topic'
], function (topic) {
	var reporters = {};

	return {
		/**
		 * Adds a collection of reporters to the reporter manager.
		 * @param reporterMap A hash map of reporters where the key corresponds to the reporter's ID and the value
		 * is an object containing keys to subscribe to topics, plus special `start` and `stop` keys. If a reporter
		 * is added with the same ID as an existing reporter, the old reporter will be stopped and then replaced.
		 */
		add: function (/**Object*/ reporterMap) {
			for (var reporterId in reporterMap) {
				if (reporterId in reporters) {
					this.stop(reporterId);
				}

				reporters[reporterId] = {
					definition: reporterMap[reporterId],
					handles: [],
					isRunning: false
				};

				this.start(reporterId);
			}
		},

		/**
		 * Removes a reporter from the current reporters collection.
		 * @param reporterId The ID of the reporter to remove. If running, the reporter will be stopped before it
		 * is removed from the collection.
		 */
		remove: function (/**string*/ reporterId) {
			var reporter = reporters[reporterId];

			if (!reporter) {
				throw new Error('Cannot remove unknown reporter ' + reporterId);
			}

			if (reporter.isRunning) {
				this.stop(reporterId);
			}

			delete reporters[reporterId];
		},

		/**
		 * Starts a reporter.
		 * @param reporterId The ID of the reporter to start.
		 */
		start: function (/**string*/ reporterId) {
			var reporter = reporters[reporterId];

			if (!reporter) {
				throw new Error('Cannot start unknown reporter ' + reporterId);
			}

			if (reporter.isRunning) {
				return;
			}

			for (var topicId in reporter.definition) {
				var fn = reporter.definition[topicId];
				if (typeof fn === 'function') {
					reporter.handles.push(topic.subscribe(topicId, fn));
				}
			}

			reporter.definition.start && reporter.definition.start();
			reporter.isRunning = true;
		},

		/**
		 * Stops a reporter.
		 * @param reporterId The ID of the reporter to stop.
		 */
		stop: function (reporterId) {
			var reporter = reporters[reporterId];

			if (!reporter) {
				throw new Error('Cannot stop unknown reporter ' + reporterId);
			}

			if (!reporter.isRunning) {
				return;
			}

			var handles = reporter.handles,
				handle;
			while ((handle = handles.pop())) {
				handle.remove();
			}

			reporter.definition.stop && reporter.definition.stop();
			reporter.isRunning = false;
		},

		/**
		 * Stops and removes all currently registered reporters.
		 */
		clear: function () {
			for (var reporterId in reporters) {
				this.remove(reporterId);
			}
		}
	};
});
