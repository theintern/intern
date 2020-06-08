import Task, {
  isTask,
  DictionaryOfPromises,
  ListOfPromises
} from '../../../src/lib/Task';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/Task', {
  'isTask()'() {
    const task = new Task(resolve => resolve(), () => {});

    assert.isTrue(isTask(task), 'Should return true');
    assert.isFalse(isTask(Promise.resolve()), 'Should return false');
    assert.isFalse(isTask(true), 'Should return false');
    assert.isFalse(isTask(null), 'Should return false');
    assert.isFalse(isTask({}), 'Should return false');
    assert.isFalse(isTask(1), 'Should return false');
    assert.isFalse(isTask(NaN), 'Should return false');
  },

  'Task.resolve': {
    'returns a task'() {
      const task = Task.resolve('foo');

      assert.isFunction(task.cancel, 'A task should have a cancel function');
      assert.isFunction(task.finally, 'A task should have a finally function');

      return task.then(result => {
        assert.strictEqual(result, 'foo', 'result should equal "foo"');
      });
    }
  },

  '.all': {
    'empty array'() {
      const dfd = this.async();
      const promise = Task.all([]).then(
        dfd.callback((value: any[]) => {
          assert.isArray(value);
          assert.deepEqual(value, []);
        })
      );
      assert.instanceOf(promise, Task, 'promise should have expected type');
    },

    'mixed values and resolved'() {
      const dfd = this.async();
      Task.all([0, Task.resolve(1), Task.resolve(2)]).then(
        dfd.callback((value: number[]) => {
          assert.isArray(value);
          assert.deepEqual(value, [0, 1, 2]);
        })
      );
    },

    'iterable argument'() {
      const dfd = this.async();
      Task.all([0, Task.resolve(1), Task.resolve(2)]).then(
        dfd.callback((value: number[]) => {
          assert.isArray(value);
          assert.deepEqual(value, [0, 1, 2]);
        })
      );
    },

    'reject if any rejected': function() {
      const dfd = this.async();
      const pending = new Task(() => {});
      const rejected = Task.reject(new Error('rejected'));

      Task.all([pending, rejected]).then(
        dfd.rejectOnError(() => {
          assert(false, 'Should not have resolved');
        }),
        dfd.callback((error: Error) => {
          assert.strictEqual(error.message, 'rejected');
        })
      );
    },

    'foreign thenables': function() {
      const dfd = this.async();
      const normal = Task.resolve(1);
      const foreign = <PromiseLike<number>>{
        then(f: Function) {
          f(2);
        }
      };

      Task.all([normal, foreign]).then(
        dfd.callback((value: number[]) => {
          assert.deepEqual(value, [1, 2]);
        })
      );
    },

    'non-callable thenables': function() {
      const dfd = this.async();
      const normal = Task.resolve(1);
      const foreign = { then: 'foo' };

      Task.all([normal, foreign]).then(
        dfd.callback((value: any[]) => {
          assert.deepEqual(value, [1, foreign]);
        })
      );
    },

    'sparse array': {
      all() {
        const dfd = this.async();
        const iterable: any[] = [];

        iterable[1] = Task.resolve(1);
        iterable[3] = Task.resolve(3);

        Task.all(iterable).then(
          dfd.callback((value: number[]) => {
            assert.isUndefined(value[0]);
            assert.strictEqual(value[1], 1);
            assert.isUndefined(value[2]);
            assert.strictEqual(value[3], 3);
          })
        );
      },

      race() {
        const dfd = this.async();
        const iterable: Task<number>[] = [];

        iterable[1] = Task.resolve(1);
        iterable[3] = Task.resolve(3);

        Task.race(iterable).then(
          dfd.callback((value: number[]) => {
            assert.isUndefined(value);
          })
        );
      }
    },

    'value not input': function() {
      const dfd = this.async();
      const iterable = [0, 1];

      Task.all(iterable).then(
        dfd.callback((value: number[]) => {
          assert.notStrictEqual(value, iterable);
        })
      );
    },

    cancelable: {
      isIterable() {
        // Make sure it checks whether each PromiseLike is cancelable
        const promise = Promise.resolve();
        const task1 = new Task(() => {});
        const task2 = new Task(() => {});
        let task1Finalized = false;
        let task2Finalized = false;
        const pending = [promise, task1, task2];

        task1.finally(() => {
          task1Finalized = true;
        });
        task2.finally(() => {
          task2Finalized = true;
        });

        cancelTasks(pending).then(() => {
          assert.isTrue(task1Finalized, 'Task 1 should have been finalized');
          assert.isTrue(task2Finalized, 'Task 2 should have been finalized');
        });
      },

      isObject() {
        // Make sure it checks whether each PromiseLike is cancelable
        const promise = Promise.resolve();
        const task1 = new Task(() => {});
        const task2 = new Task(() => {});
        let task1Finalized = false;
        let task2Finalized = false;
        const pending: { [index: string]: PromiseLike<any> } = {
          foo: task1,
          bar: task2,
          promise
        };

        task1.finally(() => {
          task1Finalized = true;
        });
        task2.finally(() => {
          task2Finalized = true;
        });

        cancelTasks(pending).then(() => {
          assert.isTrue(task1Finalized, 'Task 1 should have been finalized');
          assert.isTrue(task2Finalized, 'Task 2 should have been finalized');
        });
      }
    }
  },

  '.race': {
    'empty array'() {
      const dfd = this.async();
      Task.race([]).then(
        dfd.rejectOnError(() => {
          assert.fail(false, true, 'Task should not have resolved');
        })
      );
      setTimeout(dfd.callback(() => {}), 10);
    },

    'mixed values and resolved'() {
      const dfd = this.async();
      Task.race([0, Task.resolve(1), Task.resolve(2)]).then(
        dfd.callback((value: number) => {
          assert.strictEqual(value, 0);
        })
      );
    },

    'iterable argument'() {
      const dfd = this.async();
      Task.race([0, Task.resolve(1), Task.resolve(2)]).then(
        dfd.callback((value: number) => {
          assert.strictEqual(value, 0);
        })
      );
    },

    'reject if any rejected'() {
      const dfd = this.async();
      const pending = new Task(() => {});
      const rejected = Task.reject(new Error('rejected'));

      return Task.race([pending, rejected]).then(
        dfd.rejectOnError(() => {
          assert(false, 'Should not have resolved');
        }),
        dfd.callback((error: Error) => {
          assert.strictEqual(error.message, 'rejected');
        })
      );
    },

    'foreign thenables': function() {
      const dfd = this.async();
      const normal = Task.resolve(1);
      const foreign = <PromiseLike<any>>{
        then(f: Function) {
          f(2);
        }
      };

      Task.race([normal, foreign]).then(
        dfd.callback((value: number) => {
          assert.strictEqual(value, 1);
        })
      );
    }
  },

  '.reject': {
    error() {
      const dfd = this.async();
      let resolved = false;
      const promise = Task.reject(new Error('foo')).then(
        dfd.rejectOnError(() => {
          resolved = true;
          assert(false, 'should not have resolved');
        }),
        dfd.callback((error: Error) => {
          resolved = true;
          assert.instanceOf(error, Error, 'error value should be an Error');
          assert.propertyVal(
            error,
            'message',
            'foo',
            'error value should have expected message'
          );
        })
      );

      assert.instanceOf(promise, Task, 'promise should have expected type');
      assert.isFalse(
        resolved,
        'promise should not have resolved synchronously'
      );
    },

    'rejected thenable'() {
      const dfd = this.async();
      let resolved = false;
      const thenable = <PromiseLike<any>>{
        then(_f: Function, r: Function) {
          r(new Error('foo'));
        }
      };
      Task.resolve(thenable).then(
        dfd.rejectOnError(() => {
          resolved = true;
          assert(false, 'should not have rejected');
        }),
        dfd.callback((error: Error) => {
          resolved = true;
          // value should be resolved value of thenable
          assert.instanceOf(error, Error, 'error value should be an Error');
          assert.propertyVal(
            error,
            'message',
            'foo',
            'error value should have expected message'
          );
        })
      );

      assert.isFalse(
        resolved,
        'promise should not have resolved synchronously'
      );
    }
  },

  '.resolve': {
    'simple value'() {
      const dfd = this.async();
      let resolved = false;
      const promise = Task.resolve('foo').then(
        dfd.callback((value: string) => {
          resolved = true;
          assert.equal(value, 'foo', 'unexpected resolution value');
        }),
        dfd.rejectOnError(() => {
          resolved = true;
          assert(false, 'should not have rejected');
        })
      );

      assert.instanceOf(promise, Task, 'promise should have expected type');
      assert.isFalse(
        resolved,
        'promise should not have resolved synchronously'
      );
    },

    thenable() {
      const dfd = this.async();
      let resolved = false;
      const thenable = <PromiseLike<any>>{
        then(f: Function) {
          f(2);
        }
      };
      Task.resolve(thenable).then(
        dfd.callback((value: number) => {
          resolved = true;
          // value should be resolved value of thenable
          assert.equal(value, 2, 'unexpected resolution value');
        }),
        dfd.rejectOnError(() => {
          resolved = true;
          assert(false, 'should not have rejected');
        })
      );

      assert.isFalse(
        resolved,
        'promise should not have resolved synchronously'
      );
    }
  },

  '#cancel': {
    'basic cancel'() {
      const dfd = this.async();
      let cancelerCalled = false;
      let resolver!: () => void;
      const task = new Task(
        resolve => {
          resolver = resolve;
        },
        () => {
          cancelerCalled = true;
        }
      ).then(
        dfd.rejectOnError(() => {
          assert(false, 'Task should not have resolved');
        })
      );

      task.cancel();
      resolver();

      assert.isTrue(
        cancelerCalled,
        'Canceler should have been called synchronously'
      );

      setTimeout(dfd.callback(() => {}), 100);
    },

    'no canceler'() {
      const dfd = this.async();
      let resolver: any;
      const task = new Task(resolve => {
        resolver = resolve;
      }).then(
        dfd.rejectOnError(() => {
          assert(false, 'Task should not have resolved');
        })
      );

      task.cancel();
      resolver();

      setTimeout(dfd.callback(() => {}), 100);
    },

    "resolved/rejected promises don't call canceler"() {
      const dfd = this.async();
      let resolved = false;
      let cancelCalled = false;
      const task = new Task(
        resolve => {
          setTimeout(resolve);
        },
        () => {
          cancelCalled = true;
        }
      ).then(() => {
        resolved = true;
      });

      setTimeout(() => {
        task.cancel();
      }, 10);

      setTimeout(
        dfd.callback(() => {
          assert.isTrue(resolved, 'Task should have resolved');
          assert.isFalse(cancelCalled, 'Cancel should not have been called');
        }),
        100
      );
    }
  },

  '#finally': {
    'canceled resolve'() {
      const dfd = this.async();
      let resolver!: () => void;
      const task = new Task(
        resolve => {
          resolver = resolve;
        },
        () => {}
      )
        .then(
          dfd.rejectOnError(() => {
            assert(false, 'Task should not have resolved');
          }),
          dfd.rejectOnError(() => {
            assert(false, 'Task should not have rejected');
          })
        )
        .finally(dfd.callback(() => {}));

      task.cancel();
      resolver();
    },

    'canceled reject'() {
      const dfd = this.async();
      let resolver!: () => void;
      const task = new Task(
        (_resolve, reject) => {
          resolver = reject;
        },
        () => {}
      )
        .then(
          dfd.rejectOnError(function() {
            assert(false, 'Task should not have resolved');
          }),
          dfd.rejectOnError(function() {
            assert(false, 'Task should not have rejected');
          })
        )
        .finally(dfd.callback(() => {}));

      task.cancel();
      resolver();
    },

    'canceled with multiple children'() {
      const dfd = this.async(5000, 4);
      let resolver!: () => void;
      const task = new Task(
        resolve => {
          resolver = resolve;
        },
        () => {}
      ).finally(() => Task.resolve(5));

      const taskA = task.finally(() => {
        dfd.resolve();
        throw new Error('foo');
      });
      taskA.finally(dfd.callback(() => {}));
      task.finally(dfd.callback(() => {}));
      task.finally(dfd.callback(() => {}));

      task.cancel();
      resolver();
    },

    'canceled and resolved inside then callback'() {
      const dfd = this.async();
      let resolver: any;

      const task = new Task(
        resolve => {
          resolver = resolve;
        },
        () => {}
      )
        .then(function() {
          task.cancel();
          return new Promise(resolve => {
            setTimeout(resolve);
          });
        })
        .then(
          dfd.rejectOnError(function() {
            assert(false, 'should not have run');
          })
        )
        .then(
          dfd.rejectOnError(function() {
            assert(false, 'should not have run');
          })
        )
        .finally(dfd.callback(() => {}));

      resolver();
    },

    'canceled and rejected inside then callback'() {
      const dfd = this.async();
      let resolver: any;

      const task = new Task(
        resolve => {
          resolver = resolve;
        },
        () => {}
      )
        .then(function() {
          task.cancel();
          return new Promise((_resolve, reject) => {
            setTimeout(reject);
          }).catch(() => {});
        })
        .then(
          dfd.rejectOnError(function() {
            assert(false, 'should not have run');
          })
        )
        .then(
          dfd.rejectOnError(function() {
            assert(false, 'should not have run');
          })
        )
        .catch(() => {})
        .finally(dfd.callback(() => {}));

      resolver();
    },

    'invoked if already canceled'() {
      const dfd = this.async();
      const task = new Task(() => {});
      task.cancel();

      task.finally(dfd.callback(() => {}));
    },

    'finally is only called once when called after cancel'() {
      let callCount = 0;
      const dfd = this.async();
      const task = new Task(resolve => {
        setTimeout(resolve, 10);
      });
      task.cancel();
      task.finally(
        dfd.callback(() => {
          callCount++;
        })
      );

      setTimeout(
        dfd.callback(() => {
          assert.equal(callCount, 1);
        }),
        100
      );
    },

    'finally is only called once when called before cancel'() {
      let callCount = 0;
      const dfd = this.async();
      const task = new Task(resolve => {
        setTimeout(resolve, 10);
      });
      task.finally(
        dfd.callback(() => {
          callCount++;
        })
      );
      task.cancel();

      setTimeout(
        dfd.callback(() => {
          assert.equal(callCount, 1);
        }),
        100
      );
    },

    'finally does not change the resolve value'() {
      const dfd = this.async();
      const task = new Task(resolve => {
        setTimeout(resolve.bind(null, 'test'), 10);
      });
      const finalizedTask = task.finally(() => 'changed');
      finalizedTask.then(
        dfd.callback((value: string) => {
          assert.strictEqual(value, 'test');
        })
      );
    },

    'called for resolved Task'() {
      const dfd = this.async();
      Task.resolve(5).finally(dfd.callback(() => {}));
    },

    'called for rejected Task'() {
      const dfd = this.async();
      Task.reject(new Error('foo'))
        .catch(() => {})
        .finally(dfd.callback(() => {}));
    },

    'value passes through'() {
      const dfd = this.async();
      Task.resolve(5)
        .finally(() => {})
        .then(
          dfd.callback((value: any) => {
            assert.strictEqual(value, 5);
          })
        );
    },

    'rejection passes through'() {
      const dfd = this.async();
      Task.reject(new Error('foo'))
        .finally(() => {})
        .then(
          dfd.rejectOnError(() => {
            assert(false, 'Should not have resolved');
          }),
          dfd.callback((reason: any) => {
            assert.propertyVal(reason, 'message', 'foo');
          })
        );
    },

    'returned value is ignored'() {
      const dfd = this.async();
      Task.resolve(5)
        .finally(() => 4)
        .then(
          dfd.callback((value: number) => {
            assert.strictEqual(value, 5);
          }),
          dfd.rejectOnError(() => {
            assert(false, 'Should not have rejected');
          })
        );
    },

    'returned resolved promise is ignored'() {
      const dfd = this.async();
      Task.resolve(5)
        .finally(() => Task.resolve(4))
        .then(
          dfd.callback((value: number) => {
            assert.strictEqual(value, 5);
          }),
          dfd.rejectOnError(() => {
            assert(false, 'Should not have rejected');
          })
        );
    },

    'thrown error rejects'() {
      const dfd = this.async();
      Task.resolve(5)
        .finally(function() {
          throw new Error('foo');
        })
        .then(
          dfd.rejectOnError(() => {
            assert(false, 'Should not have rejected');
          }),
          dfd.callback((reason: Error) => {
            assert.propertyVal(reason, 'message', 'foo');
          })
        );
    },

    'returned rejected promise rejects'() {
      const dfd = this.async();
      Task.resolve(5)
        .finally(() => Promise.reject(new Error('foo')))
        .then(
          dfd.rejectOnError(() => {
            assert(false, 'Should not have rejected');
          }),
          dfd.callback((reason: Error) => {
            assert.propertyVal(reason, 'message', 'foo');
          })
        );
    },

    'returned resolved promise on rejection rejects'() {
      const dfd = this.async();
      Task.reject(new Error('foo'))
        .finally(() => Promise.resolve(5))
        .then(
          dfd.rejectOnError(() => {
            assert(false, 'Should not have rejected');
          }),
          dfd.callback((reason: Error) => {
            assert.propertyVal(reason, 'message', 'foo');
          })
        );
    }
  },

  '#catch': {
    rejection() {
      const dfd = this.async();
      const error = new Error('foo');
      Task.reject(error).catch(
        dfd.callback((err: Error) => {
          assert.strictEqual(err, error);
        })
      );
    },

    identity() {
      const dfd = this.async();
      const error = new Error('foo');
      Task.reject(error)
        .then(
          dfd.rejectOnError(() => {
            assert(false, 'Should not be resolved');
          })
        )
        .catch(
          dfd.callback((err: Error) => {
            assert.strictEqual(err, error);
          })
        );
    },

    'resolver throws'() {
      const dfd = this.async();
      const error = new Error('foo');
      const promise = new Task(function() {
        throw error;
      });

      promise.catch(
        dfd.callback((err: Error) => {
          assert.strictEqual(err, error);
        })
      );
    },

    'handler throws'() {
      const dfd = this.async();
      const error = new Error('foo');
      Task.resolve(5)
        .then(() => {
          throw error;
        })
        .catch(
          dfd.callback((err: Error) => {
            assert.strictEqual(err, error);
          })
        );
    },

    'then throws': {
      'from resolver'() {
        const dfd = this.async();
        const error = new Error('foo');
        const foreign = Task.resolve().then(() => {
          throw error;
        });

        const promise = new Task(function(resolve: Function) {
          resolve(foreign);
        });
        promise.catch(
          dfd.callback((err: Error) => {
            assert.strictEqual(err, error);
          })
        );
      },

      'from handler'() {
        const dfd = this.async();
        const error = new Error('foo');
        const foreign = Task.resolve().then(() => {
          throw error;
        });

        Task.resolve(5)
          .then(() => foreign)
          .catch(
            dfd.callback((err: Error) => {
              assert.strictEqual(err, error);
            })
          );
      },

      'then throws': {
        'from resolver'() {
          const dfd = this.async();
          const error = new Error('foo');
          const foreign = Task.resolve().then(() => {
            throw error;
          });

          const promise = new Task(resolve => {
            resolve(foreign);
          });
          promise.catch(
            dfd.callback((err: Error) => {
              assert.strictEqual(err, error);
            })
          );
        },

        'from handler': function() {
          const dfd = this.async();
          const error = new Error('foo');
          const foreign = Task.resolve().then(() => {
            throw error;
          });

          Task.resolve(5)
            .then(() => foreign)
            .catch(
              dfd.callback((err: Error) => {
                assert.strictEqual(err, error);
              })
            );
        }
      }
    }
  },

  '#then': {
    fulfillment() {
      const dfd = this.async();
      Promise.resolve(5).then(
        dfd.callback((value: number) => {
          assert.strictEqual(value, 5);
        })
      );
    },

    identity() {
      const dfd = this.async();
      Promise.resolve(5)
        .then(
          null,
          dfd.rejectOnError(() => {
            assert(false, 'Should not have resolved');
          })
        )
        .then(
          dfd.callback((value: number) => {
            assert.strictEqual(value, 5);
          })
        );
    },

    'resolve once'() {
      const dfd = this.async();
      const evilPromise = <PromiseLike<any>>{
        then(f?: Function) {
          if (f) {
            f(1);
            f(2);
          }
        }
      };

      let calledAlready = false;
      const p = Promise.resolve(evilPromise).then(
        dfd.rejectOnError((value: number) => {
          assert.strictEqual(
            calledAlready,
            false,
            'resolver should not have been called'
          );
          calledAlready = true;
          assert.strictEqual(value, 1, 'resolver called with unexpected value');
        })
      );

      p.catch(dfd.reject.bind(dfd));

      setTimeout(() => dfd.resolve(), 100);
    }
  },

  constructed: {
    resolved() {
      const dfd = this.async();
      let resolver!: () => void;
      let resolved = false;
      new Promise(resolve => {
        resolver = resolve;
      }).then(
        dfd.callback(() => {
          resolved = true;
        }),
        dfd.rejectOnError(() => {
          assert(false, 'should not have rejected');
        })
      );
      assert.isFalse(resolved, 'should not be resolved');
      resolver();
    },

    rejected() {
      const dfd = this.async();
      let resolver!: () => void;
      let resolved = false;
      new Promise((_resolve, reject) => {
        resolver = reject;
      }).then(
        dfd.rejectOnError(() => {
          assert(false, 'should not have resolved');
        }),
        dfd.callback(() => {
          resolved = true;
        })
      );
      assert.isFalse(resolved, 'should not be resolved');
      resolver();
    }
  }
});

function cancelTasks(pending: ListOfPromises | DictionaryOfPromises) {
  const tasks = Task.all(pending);
  tasks.cancel();
  return tasks;
}
