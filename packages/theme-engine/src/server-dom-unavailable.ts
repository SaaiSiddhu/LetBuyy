/** Edge/client callers must render in the supported Node SSR boundary. */
export const loadThemeServerDom: typeof import('./server-dom-runtime').loadThemeServerDom = async () => {
  throw new Error('Theme HTML sanitization requires the Node SSR runtime');
};
