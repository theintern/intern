define([
	'intern!object',
	'dojo/node!fs',
	'intern/chai!assert',
	'../../../../lib/EnvironmentType',
	'../../../../lib/Suite',
	'../../../../lib/Test',
	'../../../../lib/reporters/junit',
	'dojo/text!../../data/lib/reporters/junit/expected.xml'
], function (registerSuite, fs, assert, EnvironmentType, Suite, Test, reporter, expected) {
	function deleteReport() {
		try {
			fs.unlinkSync('report.xml');
		}
		catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}

	registerSuite({
		name: 'intern/lib/reporters/junit',

		setup: deleteReport,
		teardown: deleteReport,

		'basic tests': function () {
			var remote = {
				sessionId: 'foo',
				environmentType: new EnvironmentType({
					browserName: 'chrome',
					version: '32',
					platform: 'Mac'
				})
			};

			var assertionError = new Error('Expected 1 + 1 to equal 3');
			assertionError.name = 'AssertionError';

			var suite = new Suite({
				sessionId: remote.sessionId,
				name: 'main',
				timeElapsed: 1234,
				tests: [
					new Suite({
						name: 'suite1',
						timeElapsed: 1234,
						tests: [
							new Test({ name: 'test1', hasPassed: true, timeElapsed: 45 }),
							new Test({ name: 'test2', hasPassed: false, error: new Error('Oops'), timeElapsed: 45 }),
							new Test({ name: 'test3', hasPassed: false, error: assertionError, timeElapsed: 45 }),
							new Test({ name: 'test4', hasPassed: false, skipped: 'No time for that', timeElapsed: 45 }),
							new Suite({ name: 'suite5', timeElapsed: 45, tests: [
								new Test({ name: 'test5.1', hasPassed: true, timeElapsed: 40 })
							] })
						]
					})
				]
			});

			reporter.start();
			reporter['/session/start'](remote);
			reporter['/suite/end'](suite);
			reporter.stop();

			assert.ok(fs.existsSync('report.xml'), 'Report file should exist once the reporter is stopped');
			var report = fs.readFileSync('report.xml', { encoding: 'utf8' })
				// make sure slight changes in the stack trace does not cause the test to start failing
				.replace(/(at Test\.registerSuite\.basic tests )[^<]*/g, '$1...');
			assert.strictEqual(report, expected, 'Report should match expected result');
		}
	});
});
