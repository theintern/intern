import Cobertura from 'src/core/lib/reporters/Cobertura';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/reporters/Cobertura', {
  construct() {
    const reporter = new Cobertura(<any>{ on() {} });
    assert.equal(reporter.reportType, 'cobertura');
  },

  '#getReporterOptions': {
    'projectRoot included'() {
      const reporter = new Cobertura(<any>{ on() {} }, {
        projectRoot: '/foo/bar/baz'
      });
      assert.equal(reporter.getReporterOptions().projectRoot, '/foo/bar/baz');
    },

    'projectRoot not included'() {
      const reporter = new Cobertura(<any>{ on() {} }, {});
      assert.equal(reporter.getReporterOptions().projectRoot, undefined);
    }
  }
});
