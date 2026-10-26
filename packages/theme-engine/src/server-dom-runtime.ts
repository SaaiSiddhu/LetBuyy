/// <reference path="./jsdom-runtime.d.ts" />
/** Node SSR dependency boundary; never selected by worker/browser exports. */
export async function loadThemeServerDom() {
  const [{ default: createDOMPurify }, { JSDOM }] = await Promise.all([
    import('dompurify'),
    // Let the Node bundler externalize and trace this dependency. An ignored
    // native ESM import cannot use the serverless external-module resolution.
    import('jsdom'),
  ]);
  return { createDOMPurify, JSDOM };
}
