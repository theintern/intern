import JsonCoverage from 'src/lib/reporters/JsonCoverage';
import intern from '../../../../src/index';

const { registerSuite } = intern().getPlugin('interface.object');
const assert = intern().getPlugin('chai.assert');

registerSuite('lib/reporters/JsonCoverage', {
	construct() {
		const reporter = new JsonCoverage(<any>{ on() {} });
		assert.equal(reporter.reportType, 'json');
	}
});
