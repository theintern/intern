class Bar {
  hasRun = false;

  run() {
    throw new Error('foo');
  }
}

export = Bar;
