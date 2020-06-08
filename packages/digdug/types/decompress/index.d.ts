declare module 'decompress' {
  function decompress(
    input: string | Buffer,
    output?: string,
    options?: decompress.Options
  ): Promise<decompress.ParsedFile>;

  namespace decompress {
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

  export = decompress;
}
