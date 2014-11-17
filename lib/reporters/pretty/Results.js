/**
 * Tracks the results of a test and organizes results into groups
 */
define([], function () {
	var combinedStatus = {
		pass : { pass: 'pass', fail: 'fail', skip: 'skip', pending: 'pending' },
		fail : { pass: 'fail', fail: 'fail', skip: 'fail', pending: 'fail' },
		skip : { pass: 'skip', fail: 'fail', skip: 'skip', pending: 'skip' },
		pending : { pass: 'pending', fail: 'fail', skip: 'skip', pending: 'pending' }
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

	Results.prototype.recordPassed = function () {
		this.passed++;
		this._results[this.complete] = 'pass';
		this._recordGroupResult(this.complete, 'pass');
		this.complete++;
	};

	Results.prototype.recordFailed = function () {
		this.failed++;
		this._results[this.complete] = 'fail';
		this._recordGroupResult(this.complete, 'fail');
		this.complete++;
	};

	Results.prototype.recordSkipped = function () {
		this.skipped++;
		this._results[this.complete] = 'skip';
		this._recordGroupResult(this.complete, 'skip');
		this.complete++;
	};

	/**
	 * the result of a test
	 *
	 * @param testNum {number} the test number
	 * @returns {string} the test result
	 */
	Results.prototype.getStatus = function (testNum) {
		return this._results[testNum] || 'pending';
	};

	/**
	 * a group offset that applies to a test
	 *
	 * @param testNum {number} the test number
	 * @returns {number} the group number associated with the test
	 */
	Results.prototype.getGroup = function (testNum) {
		var overflow = (this.total % this.numGroups);
		var minGroupSize = (this.total - (this.total % this.numGroups)) / this.numGroups;
		var maxGroupSize = overflow ? minGroupSize + 1 : minGroupSize;
		var threshold = (overflow * maxGroupSize);
		var below = Math.min(testNum, threshold);
		var above = Math.max(0, testNum - below);
		var belowCalc = (below - (below % maxGroupSize)) / maxGroupSize;
		var aboveCalc = (above - (above % minGroupSize)) / minGroupSize;
		return belowCalc + aboveCalc;
	};

	/**
	 * the result of a group
	 *
	 * @param group {number} the group number
	 * @returns {string} the group result
	 */
	Results.prototype.getGroupResult = function (group) {
		return this._groupResults[group] || 'pending';
	};

	Results.prototype._recordGroupResult = function (testNum, result) {
		var currentGroup = this.getGroup(testNum);
		var currentGroupResult = this.getGroupResult(currentGroup);
		var groupStatus = combinedStatus[currentGroupResult][result];
		var isLastInGroup = testNum + 1 === this.total || currentGroup !== this.getGroup(testNum + 1);

		if (isLastInGroup && groupStatus === 'pending') {
			groupStatus = 'pass';
		}

		this._groupResults[currentGroup] =  groupStatus;
	};

	return Results;
});