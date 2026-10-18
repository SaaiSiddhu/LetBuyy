declare module 'jsdom' {
  import type { WindowLike } from 'dompurify';

  export class JSDOM {
    constructor(html?: string);
    reconfigure(settings: { url?: string }): void;
    readonly window: WindowLike & {
      readonly location: Location;
      readonly document: {
        readonly head: {
          readonly innerHTML: string;
        };
      };
    };
  }
}
