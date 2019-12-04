import JsonCoverage from 'src/core/lib/reporters/JsonCoverage';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/reporters/JsonCoverage', {
  construct() {
    const reporter = new JsonCoverage(<any>{ on() {} });
    assert.equal(reporter.reportType, 'json');
  }
});
