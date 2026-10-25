// Test-only marker override: retain normal React/DOM exports when exercising a
// composed server module that imports client presentation components.
import { createRequire, Module } from 'node:module';
const require = createRequire(new URL('../../apps/commerce/web/package.json', import.meta.url));
const filename = require.resolve('server-only');
const marker = new Module(filename);
marker.exports = {};
marker.loaded = true;
require.cache[filename] = marker;
