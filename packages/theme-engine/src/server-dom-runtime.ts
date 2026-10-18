/// <reference path="./jsdom-runtime.d.ts" />
/** Node SSR dependency boundary; never selected by worker/browser exports. */
export async function loadThemeServerDom() {
  const [{ default: createDOMPurify }, { JSDOM }] = await Promise.all([
    import('dompurify'),
    import(/* webpackIgnore: true */ 'jsdom'),
  ]);
  return { createDOMPurify, JSDOM };
}
