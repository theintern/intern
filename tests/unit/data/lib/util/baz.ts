class Baz {
	hasRun:boolean = false;

	run() {
		throw new Error('foo');
	}
}

export = Baz;
