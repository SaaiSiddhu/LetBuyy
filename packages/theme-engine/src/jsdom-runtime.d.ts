declare module 'jsdom' {
  import type { WindowLike } from 'dompurify';

  export class JSDOM {
    constructor(html?: string);
    readonly window: WindowLike & {
      readonly document: {
        readonly head: {
          readonly innerHTML: string;
        };
      };
    };
  }
}
