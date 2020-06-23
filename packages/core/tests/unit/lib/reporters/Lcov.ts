import LcovCoverage from 'src/lib/reporters/Lcov';

registerSuite('lib/reporters/Lcov', {
  construct() {
    const reporter = new LcovCoverage(<any>{ on() {} });
    assert.equal(reporter.reportType, 'lcovonly');
  }
});
