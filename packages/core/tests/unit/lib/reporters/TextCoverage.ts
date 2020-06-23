import TextCoverage from 'src/lib/reporters/TextCoverage';

registerSuite('lib/reporters/TextCoverage', {
  construct() {
    const reporter = new TextCoverage(<any>{ on() {} });
    assert.equal(reporter.reportType, 'text');
  },

  '#getReporterOptions': {
    'maxColumns included'() {
      const reporter = new TextCoverage(<any>{ on() {} }, { maxColumns: 80 });
      assert.equal(reporter.getReporterOptions().maxColumns, 80);
    },

    'maxColumns not included'() {
      const reporter = new TextCoverage(<any>{ on() {} }, {});
      assert.equal(reporter.getReporterOptions().maxColumns, undefined);
    }
  }
});
