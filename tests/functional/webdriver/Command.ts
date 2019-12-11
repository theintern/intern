import * as util from './support/util';
import Command, { Context } from 'src/webdriver/Command';
import Session from 'src/webdriver/Session';
import { Task } from 'src/common';
import Test from 'src/core/lib/Test';
import { ObjectSuiteDescriptor } from 'src/core/lib/interfaces/object';

registerSuite('Command', () => {
  let session: Session;

  return {
    before() {
      const remote = this.remote;
      return util.createSessionFromRemote(remote).then(function() {
        session = arguments[0];
      });
    },

    beforeEach() {
      return session.get('about:blank').then(function() {
        return session.setTimeout('implicit', 0);
      });
    },

    tests: {
      'error handling': {
        'initialiser throws'() {
          return new Command(session, function() {
            throw new Error('broken');
          })
            .then(
              function() {
                throw new Error(
                  'Error thrown in initialiser should reject the Command'
                );
              },
              function(error: Error) {
                assert.strictEqual(error.message, 'broken');
                assert.match(
                  error.stack!,
                  /broken.*tests\/functional\/webdriver\/Command\.[tj]s:\d+/s,
                  'Stack trace should point back to the error'
                );
                error.message += ' 2';
                throw error;
              }
            )
            .then(
              function() {
                throw new Error(
                  'Error thrown in parent Command should reject child Command'
                );
              },
              function(error: Error) {
                if (error.name === 'AssertionError') {
                  throw error;
                }
                assert.strictEqual(error.message, 'broken 2');
              }
            );
        },

        'invalid async command'() {
          const command = new Command(session).sleep(100);
          Command.addSessionMethod(command, 'invalid', function() {
            return new Task((_resolve, reject) => {
              setTimeout(function() {
                reject(new Error('Invalid call'));
              }, 0);
            });
          });

          return (<any>command).invalid().then(
            function() {
              throw new Error('Invalid command should have thrown error');
            },
            function(error: Error) {
              assert.strictEqual(error.message, 'Invalid call');
              const stack = error.stack!;
              assert.include(
                stack.slice(0, stack.indexOf('\n')),
                error.message,
                'Original error message should be provided on the first line of the stack trace'
              );
              assert.match(
                stack,
                /Invalid call.*tests\/functional\/webdriver\/Command\.[tj]s:\d+/s,
                'Stack trace should point back to the async method call that eventually threw the error'
              );
            }
          );
        },

        'catch recovery'() {
          return new Command(session)
            .then(function() {
              throw new Error('Boom');
            })
            .catch(function() {
              const expected: Context = [];
              expected.isSingle = true;
              expected.depth = 0;
              assert.deepEqual(
                this.context,
                expected,
                'Context should be copied in error path'
              );
            });
        }
      },

      initialisation(this: Test) {
        assert.throws(function() {
          new (<any>Command)();
        }, /A parent Command or Session must be provided to a new Command/);

        const dfd = this.async();
        const parent = new Command<string>(session, function(setContext) {
          setContext(<any>'foo');
          return Task.resolve('bar');
        });

        const expectedContext: Context = ['foo'];
        expectedContext.isSingle = true;
        expectedContext.depth = 0;

        const command = parent.then(
          dfd.callback(function(this: Command<any>, returnValue: string) {
            assert.isTrue(
              this === command,
              'The `this` object in callbacks should be the Command object'
            );
            assert.deepEqual(
              command.context,
              expectedContext,
              'The context of the Command should be set by the initialiser'
            );
            assert.deepEqual(
              returnValue,
              'bar',
              'The return value of the initialiser should be exposed to the first callback'
            );
          })
        );

        return dfd.promise;
      },

      'basic chaining'() {
        const command = new Command(session);
        return command
          .get('tests/functional/webdriver/data/default.html')
          .getPageTitle()
          .then(function(pageTitle) {
            assert.strictEqual(pageTitle, 'Default & <b>default</b>');
          })
          .get('tests/functional/webdriver/data/form.html')
          .getPageTitle()
          .then(function(pageTitle) {
            assert.strictEqual(pageTitle, 'Form');
          });
      },

      'child is a separate command'() {
        const parent = new Command(session).get(
          'tests/functional/webdriver/data/default.html'
        );
        const child = parent.findByTagName('p');

        return child
          .then(function(element) {
            assert.notStrictEqual(
              child,
              <any>parent,
              'Getting an element should cause a new Command to be created'
            );
            assert.isObject(
              element,
              'Element should be provided to first callback of new Command'
            );
          })
          .getTagName()
          .then(function(tagName) {
            assert.strictEqual(
              tagName,
              'p',
              'Tag name of context element should be provided'
            );
          });
      },

      'basic form interaction'(this: Test) {
        if (!session.capabilities.mouseEnabled) {
          this.skip('mouse not enabled');
        }

        const command = new Command(session);
        return command
          .get('tests/functional/webdriver/data/form.html')
          .findById('input')
          .click()
          .type('hello')
          .getProperty<string>('value')
          .then(function(value) {
            assert.strictEqual(
              value,
              'hello',
              'Typing into a form field should put data in the field'
            );
          });
      },

      '#findAll'() {
        return new Command(session)
          .get('tests/functional/webdriver/data/elements.html')
          .findAllByClassName('b')
          .getAttribute('id')
          .then(function(ids) {
            assert.deepEqual(ids, ['b2', 'b1', 'b3', 'b4']);
          });
      },

      '#findAll chain'() {
        return new Command(session)
          .get('tests/functional/webdriver/data/elements.html')
          .findById('c')
          .findAllByClassName('b')
          .getAttribute('id')
          .then(function(ids) {
            assert.deepEqual(ids, ['b3', 'b4']);
          })
          .findAllByClassName('a')
          .then(function(elements) {
            assert.lengthOf(elements, 0);
          })
          .end(2)
          .end()
          .findAllByClassName('b')
          .getAttribute('id')
          .then(function(ids) {
            assert.deepEqual(ids, ['b2', 'b1', 'b3', 'b4']);
          });
      },

      '#findAll + #findAll'() {
        return new Command(session)
          .get('tests/functional/webdriver/data/elements.html')
          .findAllByTagName('div')
          .findAllByCssSelector('span, a')
          .getAttribute('id')
          .then(function(ids) {
            assert.deepEqual(ids, ['f', 'g', 'j', 'i1', 'k', 'zz']);
          });
      },

      '#findDisplayed'() {
        if (session.capabilities.noElementDisplayed) {
          this.skip('Remote does not support /displayed endpoint');
        }

        return new Command(session)
          .get('tests/functional/webdriver/data/visibility.html')
          .findDisplayedByClassName('multipleVisible')
          .getVisibleText()
          .then(function(text) {
            assert.strictEqual(
              text,
              'b',
              'The first visible element should be returned'
            );
          });
      },

      // Check that when the mouse is pressed on one element and is moved
      // over another element before being released, the mousedown event is
      // generated for the first element and the mouseup event is generated
      // for the second.
      '#moveMouseTo usesElement'(this: Test) {
        if (!session.capabilities.mouseEnabled) {
          this.skip('mouse not enabled');
        }

        return new Command(session)
          .get('tests/functional/webdriver/data/pointer.html')
          .findById('a')
          .moveMouseTo()
          .pressMouseButton()
          .end()
          .findById('b')
          .moveMouseTo()
          .releaseMouseButton()
          .execute<{
            mousedown: { a?: any[] };
            mouseup: { b?: any[] };
          }>('return result;')
          .then(function(result) {
            assert.isTrue(
              result.mousedown.a && result.mousedown.a.length > 0,
              'Expected mousedown event in element a'
            );
            assert.isTrue(
              result.mouseup.b && result.mouseup.b.length > 0,
              'Expected mouseup event in element b'
            );
          });
      },

      '#sleep'() {
        const startTime = Date.now();
        return new Command(session).sleep(2000).then(function() {
          assert.closeTo(
            Date.now() - startTime,
            2000,
            200,
            'Sleep should prevent next command from executing for the specified amount of time'
          );
        });
      },

      '#end beyond the top of the command list'() {
        const expected: Context = ['a'];
        expected.depth = 0;

        return new Command<void>(session, function(setContext) {
          setContext(<any>['a']);
        })
          .end(20)
          .then(function() {
            assert.deepEqual(
              this.context,
              expected,
              'Calling #end when there is nowhere else to go should be a no-op'
            );
          });
      },

      '#end in a long chain'() {
        return new Command(session)
          .then(function(_: any, setContext: Function) {
            setContext!(['a']);
          })
          .end()
          .then(function() {
            assert.lengthOf(this.context, 0);
          })
          .end()
          .then(function() {
            assert.lengthOf(
              this.context,
              0,
              '#end should not ascend to higher depths earlier in the command chain'
            );
          });
      },

      '#catch'() {
        const command = new Command(session);
        let callback: Function | undefined;
        let errback: Function | undefined;
        const expectedErrback = function() {};
        command.then = <any>function() {
          callback = arguments[0];
          errback = arguments[1];
          return 'thenCalled';
        };
        const result = command.catch(expectedErrback);
        assert.strictEqual(result, <any>'thenCalled');
        assert.isNull(callback);
        assert.strictEqual(errback, expectedErrback);
      },

      '#finally'() {
        const command = new Command(session);
        const promise = command['_task'];
        const expected = function() {};
        let wasCalled = false;
        let result: Function | undefined;

        promise.finally = <any>function(cb: Function) {
          wasCalled = true;
          result = cb;
        };

        command.finally(expected);
        assert.isTrue(wasCalled);
        assert.strictEqual(result, expected);
      },

      '#cancel'(this: Test) {
        const command = new Command(session);
        const sleepCommand = command.sleep(5000);
        const dfd = this.async();
        sleepCommand.cancel();

        const startTime = Date.now();

        sleepCommand.finally(function() {
          assert.isBelow(
            Date.now() - startTime,
            4000,
            'Cancel should not wait for sleep to complete'
          );
          dfd.resolve();
        });
      },

      'session createsContext'() {
        const command: any = new Command<void>(session, function(setContext) {
          setContext(<any>'a');
        });

        Command.addSessionMethod(
          command,
          'newContext',
          util.forCommand(
            function() {
              return Task.resolve('b');
            },
            { createsContext: true }
          )
        );

        return command.newContext().then(function(this: Command<any>) {
          const expected: Context = ['b'];
          expected.isSingle = true;
          expected.depth = 1;

          assert.deepEqual(
            this.context,
            expected,
            'Function that returns a value that has been annotated with createsContext should generate a new context'
          );
        });
      },

      'element createsContext'() {
        const command = new Command<void>(session, function(setContext) {
          setContext(<any>{
            elementId: 'foo',
            // Provide a custom element method
            newContext: util.forCommand(
              function() {
                return Task.resolve('b');
              },
              { createsContext: true }
            )
          });
        });

        Command.addElementMethod(command, 'newContext');

        return (<any>command).newContext().then(function(this: Command<any>) {
          const expected: Context = ['b'];
          expected.isSingle = true;
          expected.depth = 1;

          assert.deepEqual(
            this.context,
            expected,
            'Function that returns a value that has been annotated with createsContext should generate a new context'
          );
        });
      },

      'session usesElement single'() {
        const command: any = new Command<void>(session, function(setContext) {
          setContext(<any>'a');
        });

        Command.addSessionMethod(
          command,
          'useElement',
          util.forCommand(
            function(context: string, arg: string) {
              assert.strictEqual(
                context,
                'a',
                'Context object should be passed as first argument to function annotated with usesElement'
              );
              assert.strictEqual(
                arg,
                'arg1',
                'Arguments should be passed after the context'
              );
            },
            { usesElement: true }
          )
        );

        return command.useElement('arg1');
      },

      'session usesElement multiple'() {
        const command: any = new Command<void>(session, function(setContext) {
          setContext(<any>['a', 'b']);
        });

        const expected = [
          ['a', 'arg1'],
          ['b', 'arg1']
        ];

        Command.addSessionMethod(
          command,
          'useElement',
          util.forCommand(
            function(context: any, arg: any) {
              const _expected = expected.shift()!;

              assert.strictEqual(
                context,
                _expected[0],
                'Context object should be passed as first argument to function annotated with usesElement'
              );
              assert.strictEqual(
                arg,
                _expected[1],
                'Arguments should be passed after the context'
              );
            },
            { usesElement: true }
          )
        );

        return command.useElement('arg1');
      }
    }
  } as ObjectSuiteDescriptor;
});
