declare namespace Decompress {
	interface decompress {
		(input: string | Buffer, output?: string, options?: Options): Promise<ParsedFile>
	}

	interface FileDescriptor {
		mode: number;
		mtime: string;
		path: string;
		type: string;
	}

	interface ParsedFile extends FileDescriptor {
		data: Buffer;
	}

	interface Plugin {
		(): (buf: Buffer) => Promise<Buffer>;
	}

	export interface Options {
		filter?(file: FileDescriptor): boolean;
		map?(file: FileDescriptor): FileDescriptor;
		plugins?: Plugin[];
		strip?: number;
	}
}

declare module "decompress" {
	type decompress = Decompress.decompress;
	const mod: Decompress.decompress;
	export = mod;
}
