import HtmlCoverage from 'src/lib/reporters/HtmlCoverage';

registerSuite('lib/reporters/HtmlCoverage', {
  construct() {
    const reporter = new HtmlCoverage(<any>{ on() {} });
    assert.equal(reporter.reportType, 'html');
  },

  '#getReporterOptions': {
    'verbose included'() {
      const reporter = new HtmlCoverage(<any>{ on() {} }, { verbose: true });
      assert.equal(reporter.getReporterOptions().verbose, true);
    },

    'verbose not included'() {
      const reporter = new HtmlCoverage(<any>{ on() {} }, {});
      assert.equal(reporter.getReporterOptions().verbose, undefined);
    }
  }
});
