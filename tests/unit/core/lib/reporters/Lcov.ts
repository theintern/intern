import LcovCoverage from 'src/core/lib/reporters/Lcov';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/reporters/Lcov', {
  construct() {
    const reporter = new LcovCoverage(<any>{ on() {} });
    assert.equal(reporter.reportType, 'lcovonly');
  }
});
