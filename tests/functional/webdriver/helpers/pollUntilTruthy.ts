import Command from 'src/webdriver/Command';
import pollUntilTruthy from 'src/webdriver/helpers/pollUntilTruthy';
import { createSessionFromRemote } from '../support/util';
import { ObjectSuiteDescriptor } from 'src/core/lib/interfaces/object';

registerSuite('helpers/pollUntilTruthy', () => {
  let command: Command<any>;

  return {
    before() {
      const remote = this.remote;
      return createSessionFromRemote(remote).then(session => {
        command = new Command<void>(session);
      });
    },

    tests: {
      'basic test'() {
        return command
          .get('tests/functional/data/elements.html')
          .findById('makeD')
          .click()
          .then(
            pollUntilTruthy(
              'return document.getElementById("d") != null;',
              [],
              1000
            )
          )
          .then(function(result) {
            assert.isTrue(result, 'Expected poll result to be true');
          });
      },

      'without args'() {
        return command
          .get('tests/functional/data/elements.html')
          .findById('makeD')
          .click()
          .then(
            pollUntilTruthy(
              'return document.getElementById("d") != null;',
              1000
            )
          )
          .then(function(result) {
            assert.isTrue(result, 'Expected poll result to be true');
          });
      },

      'early timeout'() {
        return command
          .get('tests/functional/data/elements.html')
          .findById('makeDSlowly')
          .click()
          .then(
            pollUntilTruthy(
              'return document.getElementById("d") != null;',
              [],
              100,
              25
            )
          )
          .then(
            function() {
              throw new Error('Polling should fail after a timeout');
            },
            function(error: Error) {
              assert.strictEqual(error.name, 'ScriptTimeout');
            }
          );
      },

      'iteration check'() {
        return command
          .get('tests/functional/data/default.html')
          .then(
            pollUntilTruthy<number | never>(
              function() {
                const anyWindow = <any>window;
                if (!anyWindow.counter) {
                  anyWindow.counter = 0;
                }

                if (++anyWindow.counter === 4) {
                  return anyWindow.counter;
                }
              },
              [],
              1000,
              25
            )
          )
          .then(function(counter) {
            assert.strictEqual(counter, 4);
          });
      }
    }
  } as ObjectSuiteDescriptor;
});
