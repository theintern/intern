/// <reference path="./charm.d.ts" />
/// <reference path="../node/node.d.ts" />

import charm = require('charm');
import encode = require('charm/lib/encode');

let inst: charm.Charm;

inst = charm();
inst = charm(process);
inst = charm(process.stdin);
inst = charm(process.stdout);
inst = charm(process.stdin, process.stdout);
inst = charm(process.stdout, process.stdin);

inst.pipe(process.stdout);
inst.write('Hello')
	.write(new Buffer('World', 'utf8'))
	.reset()
	.position(0, 0)
	.position(function (x: number, y: number): void {})
	.move(1, 2)
	.up()
	.up(1)
	.down()
	.down(1)
	.left()
	.left(1)
	.right()
	.right(1)
	.push()
	.push(true)
	.pop()
	.pop(true)
	.column(0)
	.erase('end')
	.delete('line')
	.delete('line', 1)
	.delete('char')
	.delete('char', 1)
	.insert(true)
	.insert(true, 1)
	.insert('line')
	.insert('line', 1)
	.insert('char')
	.insert('char', 1)
	.display('reset')
	.foreground(10)
	.foreground('black')
	.background(0)
	.background('white')
	.cursor(true)
	.end('Goodbye');

inst = new charm.Charm();
inst.end(new Buffer('Forever', 'utf8'));
inst.destroy();

{ let codes: Buffer[] = charm.extractCodes(new Buffer('a')); }
{ let codes: string[] = charm.extractCodes('a'); }
{ let ord: number = encode.ord('a'); }
{ let encoded: Buffer = encode('a'); encoded = encode([ 'a' ]); }
