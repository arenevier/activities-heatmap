declare module "@garmin/fitsdk" {
  // biome-ignore lint/complexity/noStaticOnlyClass:
  export class Stream {
    static fromBuffer(data: Buffer): Stream;
  }
  export class Decoder {
    isFIT(): boolean;
    constructor(stream: Stream);
    read(): { messages: { recordMesgs: any[] }; errors: Error[] };
  }
}
