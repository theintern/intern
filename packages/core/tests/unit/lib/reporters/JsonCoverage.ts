import JsonCoverage from 'src/lib/reporters/JsonCoverage';

registerSuite('lib/reporters/JsonCoverage', {
  construct() {
    const reporter = new JsonCoverage(<any>{ on() {} });
    assert.equal(reporter.reportType, 'json');
  }
});
