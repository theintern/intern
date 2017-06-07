import LcovCoverage from 'src/lib/reporters/LcovCoverage';
import intern from '../../../../src/index';

const { registerSuite } = intern().getPlugin('interface.object');
const assert = intern().getPlugin('chai.assert');

registerSuite('lib/reporters/LcovCoverage', {
	construct() {
		const reporter = new LcovCoverage(<any>{ on() {} });
		assert.equal(reporter.reportType, 'lcov');
	}
});
