import HtmlCoverage from 'src/lib/reporters/HtmlCoverage';
import intern from '../../../../src/index';

const { registerSuite } = intern().getPlugin('interface.object');
const assert = intern().getPlugin('chai.assert');

registerSuite('lib/reporters/HtmlCoverage', {
	construct() {
		const reporter = new HtmlCoverage(<any>{ on() {} });
		assert.equal(reporter.reportType, 'html');
	}
});
