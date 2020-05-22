class Baz {
  hasRun = false;

  run() {
    throw new Error('foo');
  }
}

export = Baz;
