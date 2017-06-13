import HtmlCoverage from 'src/lib/reporters/HtmlCoverage';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/reporters/HtmlCoverage', {
	construct() {
		const reporter = new HtmlCoverage(<any>{ on() {} });
		assert.equal(reporter.reportType, 'html');
	}
});
