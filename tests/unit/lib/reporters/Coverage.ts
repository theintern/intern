import Coverage from 'src/lib/reporters/Coverage';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/reporters/Coverage', {
	construct() {
		const reporter = new Coverage(<any>{ on() {} });
		assert.equal(reporter.reportType, 'text');
	},

	'#getReporterOptions': {
		'maxColumns included'() {
			const reporter = new Coverage(<any>{ on() {} }, { maxColumns: 80 });
			assert.equal(reporter.getReporterOptions().maxColumns, 80);
		},

		'maxColumns not included'() {
			const reporter = new Coverage(<any>{ on() {} }, {});
			assert.equal(reporter.getReporterOptions().maxColumns, undefined);
		}
	}
});
