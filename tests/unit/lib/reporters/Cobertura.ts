import Cobertura from 'src/lib/reporters/Cobertura';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/reporters/Cobertura', {
	construct() {
		const reporter = new Cobertura(<any>{ on() {} });
		assert.equal(reporter.reportType, 'cobertura');
	}
});
