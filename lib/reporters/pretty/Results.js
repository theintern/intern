define([  ], function () {
	var combinedStatus = {
		pass : { pass: 'pass', fail: 'fail', skip: 'skip', pending: 'pending' },
		fail : { pass: 'fail', fail: 'fail', skip: 'fail', pending: 'fail' },
		skip : { pass: 'skip', fail: 'fail', skip: 'skip', pending: 'skip' },
		pending : { pass: 'pending', fail: 'fail', skip: 'skip', pending: 'pending' }
	};

	var status = {
		PASS: 'pass',
		FAIL: 'fail',
		SKIP: 'skip',
		PENDING: 'pending'
	};

	function Results(totalTests, maxGroups) {
		this.total = totalTests;
		this.passed = 0;
		this.failed = 0;
		this.skipped = 0;
		this.complete = 0;

		this.maxGroups = maxGroups;
		this.numGroups = Math.min(totalTests, maxGroups);
		this._results = new Array(totalTests);
		this._groupResults = new Array(this.numGroups);
	}

	Results.prototype = {
		recordPassed: function () {
			this.passed++;
			this._results[this.complete] = status.PASS;
			this._recordGroupResult(this.complete, status.PASS);
			this.complete++;
		},

		recordFailed: function () {
			this.failed++;
			this._results[this.complete] = status.FAIL;
			this._recordGroupResult(this.complete, status.FAIL);
			this.complete++;
		},

		recordSkipped: function () {
			this.skipped++;
			this._results[this.complete] = status.SKIP;
			this._recordGroupResult(this.complete, status.SKIP);
			this.complete++;
		},

		getStatus: function (testNum) {
			return this._results[testNum] || status.PENDING;
		},

		getGroup: function (testNum) {
			var overflow = (this.total % this.numGroups);
			var minGroupSize = (this.total - (this.total % this.numGroups)) / this.numGroups;
			var maxGroupSize = overflow ? minGroupSize + 1 : minGroupSize;
			var threshold = (overflow * maxGroupSize);
			var below = Math.min(testNum, threshold);
			var above = Math.max(0, testNum - below);
			var belowCalc = (below - (below % maxGroupSize)) / maxGroupSize;
			var aboveCalc = (above - (above % minGroupSize)) / minGroupSize;
			return belowCalc + aboveCalc;
		},

		getGroupResult: function (group) {
			return this._groupResults[group] || status.PENDING;
		},

		_recordGroupResult: function (testNum, result) {
			var currentGroup = this.getGroup(testNum);
			var currentGroupResult = this.getGroupResult(currentGroup);
			var groupStatus = combinedStatus[currentGroupResult][result];

			if (groupStatus === status.PENDING &&
				(testNum + 1 === this.total || currentGroup !== this.getGroup(testNum + 1))) {
				groupStatus = status.PASS;
			}

			this._groupResults[currentGroup] = groupStatus;
		}
	};

	return Results;
});