import { mockImport } from 'tests/support/mockUtil';
import Suite from 'src/lib/Suite';
import Test from 'src/lib/Test';
import _Dom from 'src/lib/reporters/Dom';
import { createDocument } from 'tests/support/browserDom';
import { createMockBrowserExecutor } from 'tests/support/unit/mocks';

const mockExecutor = createMockBrowserExecutor();

let Dom: typeof _Dom;

registerSuite('lib/reporters/Dom', {
  async before() {
    ({ default: Dom } = await mockImport(
      () => import('src/lib/reporters/Dom'),
      (replace) => {
        replace(() => import('@theintern/common')).with({
          global: { scrollTo() {} },
        });
      }
    ));
  },

  tests: {
    error() {
      const doc = createDocument();
      const reporter = new Dom(mockExecutor, { document: doc });
      const error = new Error('Oops');

      reporter.error(error);

      // body contains the error node which contains the error text node
      assert.match(
        doc.body.textContent!,
        /^(Error: )?Oops/,
        'expected node with error text to have been added'
      );
    },

    suiteEnd: {
      pass() {
        const doc = createDocument();
        const reporter = new Dom(mockExecutor, { document: doc });
        const suite = new Suite({
          executor: mockExecutor,
          name: 'suite',
          tests: [
            new Test({
              name: 'foo',
              test: () => {},
              hasPassed: false,
            }),
          ],
        });

        reporter.suiteEnd(suite);

        assert.lengthOf(doc.body.children, 0, 'expected no change to the doc');
      },

      fail() {
        const doc = createDocument();

        // The session suite is always created first, so a suite of
        // interest will be a child of that
        const sessionSuiteNode = doc.createElement('ol');
        const childSuiteItem = doc.createElement('li');
        sessionSuiteNode.appendChild(childSuiteItem);
        const suiteNode = doc.createElement('ol');
        childSuiteItem.appendChild(suiteNode);
        doc.body.appendChild(sessionSuiteNode);

        const reporter = new Dom(mockExecutor, {
          document: doc,
          suiteNode: suiteNode,
        });
        const suite = new Suite({
          executor: mockExecutor,
          name: 'suite',
          tests: [
            new Test({
              name: 'foo',
              test: () => {},
              hasPassed: false,
            }),
          ],
        });
        suite.error = new Error('failed');

        reporter.suiteEnd(suite);

        assert.match(sessionSuiteNode.innerHTML, /Suite "suite" failed/);
      },
    },

    suiteStart() {
      const doc = createDocument();
      const reporter = new Dom(mockExecutor, { document: doc });
      const suite = new Suite(<any>{ name: 'suite', parent: {} });

      reporter.suiteStart(suite);

      const list = doc.body.children[0];
      assert.equal(list.tagName, 'OL');
      assert.lengthOf(list.children, 0);
      assert.equal(list.textContent, '');

      // subsequent suite
      reporter.suiteStart(suite);
      assert.lengthOf(list.children, 1);
      assert.equal(list.textContent, 'suite');
    },

    testEnd: {
      pass() {
        const doc = createDocument();
        const reporter = new Dom(mockExecutor, { document: doc });
        const test = new Test({
          name: 'test',
          timeElapsed: 123,
          test: () => {},
          parent: <any>{ name: 'parent', id: 'parent' },
          hasPassed: true,
        });

        const testNode = doc.createElement('div');
        reporter.testNode = <any>testNode;
        reporter.testEnd(test);

        assert.equal(testNode.textContent, ' passed (123ms)');
      },

      fail() {
        const doc = createDocument();
        const reporter = new Dom(mockExecutor, { document: doc });
        const test = new Test({
          name: 'test',
          timeElapsed: 123,
          test: () => {},
          parent: <any>{ name: 'parent', id: 'parent' },
        });
        (<any>test).error = new Error('Oops');

        const testNode = doc.createElement('div');
        reporter.testNode = <any>testNode;
        reporter.testEnd(test);

        assert.match(testNode.textContent!, /^ failed \(123ms\)/);
      },

      skipped() {
        const doc = createDocument();
        const reporter = new Dom(mockExecutor, { document: doc });
        const test = new Test({
          name: 'testy',
          skipped: 'yes',
          test: () => {},
          parent: <any>{ name: 'parent', id: 'parent' },
        });

        reporter.testEnd(test);

        assert.equal(
          reporter.testNode!.textContent,
          `${test.name} skipped (yes)`
        );
      },
    },

    testStart() {},
  },
});
