// Type definitions for charm
// Project: https://github.com/substack/node-charm
// Definitions by: Colin Snover <https://github.com/csnover/>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference path="../node/node.d.ts" />

declare module 'charm' {
	import { Stream } from 'stream';

	function charm(): charm.Charm;
	function charm(process: NodeJS.Process): charm.Charm;
	function charm(inStream: NodeJS.ReadableStream, outStream?: NodeJS.WritableStream): charm.Charm;
	function charm(outStream: NodeJS.WritableStream, inStream?: NodeJS.ReadableStream): charm.Charm;

	namespace charm {
		export class Charm extends Stream {
			writable: boolean;
			readable: boolean;
			pending: Array<(buf: Buffer | string) => boolean>;

			write(buf: Buffer | string): this;
			destroy(): void;
			end(buf?: Buffer | string): void;
			reset(): this;
			position(x: number, y: number): this;
			position(cb: (x: number, y: number) => void): this;
			move(x: number, y: number): this;
			up(y?: number): this;
			down(y?: number): this;
			right(x?: number): this;
			left(x?: number): this;
			column(x: number): this;
			push(withAttributes?: boolean): this;
			pop(withAttributes?: boolean): this;
			erase(s: 'end'): this;
			erase(s: '$'): this;
			erase(s: 'start'): this;
			erase(s: '^'): this;
			erase(s: 'line'): this;
			erase(s: 'down'): this;
			erase(s: 'up'): this;
			erase(s: 'screen'): this;
			erase(s: string): this;
			delete(s: 'line', n?: number): this;
			delete(s: 'char', n?: number): this;
			delete(s: string, n?: number): this;
			insert(mode: boolean, n?: number): this;
			insert(mode: 'line', n?: number): this;
			insert(mode: 'char', n?: number): this;
			insert(mode: string, n?: number): this;
			display(attr: 'reset'): this;
			display(attr: 'bright'): this;
			display(attr: 'dim'): this;
			display(attr: 'underscore'): this;
			display(attr: 'blink'): this;
			display(attr: 'reverse'): this;
			display(attr: 'hidden'): this;
			display(attr: string): this;
			foreground(color: number): this;
			foreground(color: 'black'): this;
			foreground(color: 'red'): this;
			foreground(color: 'green'): this;
			foreground(color: 'yellow'): this;
			foreground(color: 'blue'): this;
			foreground(color: 'magenta'): this;
			foreground(color: 'cyan'): this;
			foreground(color: 'white'): this;
			foreground(color: string): this;
			background(color: number): this;
			background(color: 'black'): this;
			background(color: 'red'): this;
			background(color: 'green'): this;
			background(color: 'yellow'): this;
			background(color: 'blue'): this;
			background(color: 'magenta'): this;
			background(color: 'cyan'): this;
			background(color: 'white'): this;
			background(color: string): this;
			cursor(visible: boolean): this;
		}

		export function extractCodes(buf: Buffer): Buffer[];
		export function extractCodes(buf: string): string[];
	}

	export = charm;
}

declare module 'charm/lib/encode' {
	function encode(xs: string | string[]): Buffer;
	namespace encode {
		export function ord(s: string): number;
	}
	export = encode;
}
