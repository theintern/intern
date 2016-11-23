declare module 'charm' {
	import { Stream } from 'stream';

	namespace charm {
		type CharmColor = number|'black'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'white';
		type CharmAttributes = 'reset'|'bright'|'dim'|'underscore'|'blink'|'reverse'|'hidden';

		export class Charm extends Stream {
			constructor();
			write(buf: string|Buffer): this;
			destroy(): void;
			end(buf: string|Buffer): void;
			reset(): this;
			position(x: number, y: number): this;
			move(x: number, y: number): this;
			up(y: number): this;
			down(y: number): this;
			right(x: number): this;
			left(x: number): this;
			column(x: number): this;
			push(withAttributes: boolean): this;
			pop(withAttributes: boolean): this;
			erase(s: string|Buffer): this;
			delete(s: string|Buffer, n: number): this;
			insert(mode: boolean|string, n: number): this;
			display(attr: CharmAttributes): this;
			foreground(color: CharmColor): this;
			background(color: CharmColor): this;
			cursor(visible: boolean): this;
		}
		export function extractCodes(buf: Buffer|string): string[];
	}

	function charm(): charm.Charm;

	export = charm;
}

declare module 'charm/lib/encode' {
	interface EncodeStatic {
		(xs: string): Buffer|string;
		ord(c: string): Buffer|string;
	}

	const encode: EncodeStatic;
	export = encode;
}
