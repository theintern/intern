import LcovCoverage from 'src/lib/reporters/Lcov';
import intern from '../../../../src/index';

const { registerSuite } = intern().getPlugin('interface.object');
const assert = intern().getPlugin('chai.assert');

registerSuite('lib/reporters/Lcov', {
	construct() {
		const reporter = new LcovCoverage(<any>{ on() {} });
		assert.equal(reporter.reportType, 'lcovonly');
	}
});
