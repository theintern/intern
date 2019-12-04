import Deferred from 'src/core/lib/Deferred';

registerSuite('lib/Deferred', {
  '#rejectOnError': {
    'preserves context'() {
      const dfd = new Deferred();

      const foo = {
        bar: dfd.rejectOnError(function(this: any) {
          assert.strictEqual(this, foo);
          dfd.resolve();
        })
      };

      foo.bar();

      return dfd.promise;
    }
  },

  '#callback': {
    'preserves context'() {
      const dfd = new Deferred();

      const foo = {
        bar: dfd.callback(function(this: any) {
          assert.strictEqual(this, foo);
        })
      };

      foo.bar();

      return dfd.promise;
    }
  }
});
