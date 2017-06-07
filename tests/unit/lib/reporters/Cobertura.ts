import Cobertura from 'src/lib/reporters/Cobertura';
import intern from '../../../../src/index';

const { registerSuite } = intern().getPlugin('interface.object');
const assert = intern().getPlugin('chai.assert');

registerSuite('lib/reporters/Cobertura', {
	construct() {
		const reporter = new Cobertura(<any>{ on() {} });
		assert.equal(reporter.reportType, 'cobertura');
	}
});
