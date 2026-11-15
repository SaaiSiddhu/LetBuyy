import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Execute the application's actual embedded script. Dart tests separately
// validate its URL/nonce escaping; these tests exercise browser promise races.
const dart = readFileSync(new URL('../lib/widgets/shared/merchant_webm_video_controller.dart', import.meta.url), 'utf8');
const match = dart.match(/<script nonce="\$nonce">([\s\S]*?)<\/script>/);
assert(match, 'Canonical embedded media script must be present');
const nonce = 'synthetic_video_document_nonce_1';
const script = match[1].replace('${jsonEncode(nonce)}', JSON.stringify(nonce));
const flush = () => new Promise(resolve => setImmediate(resolve));

function browser({ playbackError } = {}) {
  const messages = [], events = new Map();
  let rejectPlay;
  const video = {
    readyState: 1, duration: 3, currentTime: 0, videoWidth: 64,
    videoHeight: 64, paused: true, muted: true, volume: 1, error: null,
    starts: 0,
    addEventListener(name, listener) { events.set(name, listener); },
    play() {
      this.starts++;
      if (playbackError) return Promise.reject(Object.assign(new Error('Private decoder detail'), { name: playbackError }));
      this.paused = false;
      return new Promise((_resolve, reject) => { rejectPlay = reject; });
    },
    pause() {
      this.paused = true;
      rejectPlay?.(Object.assign(new Error('Play was interrupted'), { name: 'AbortError' }));
      rejectPlay = undefined;
      events.get('pause')?.();
    },
    removeAttribute() {},
    load() {},
  };
  const document = {
    hidden: false,
    getElementById(id) { assert.equal(id, 'video'); return video; },
    addEventListener(name, listener) { events.set(name, listener); },
  };
  const window = {};
  runInNewContext(script, {
    document, window,
    MerchantVideo: { postMessage(value) { messages.push(JSON.parse(value)); } },
  });
  return { video, document, player: window.merchantVideo, messages, events };
}

test('metadata alone never starts playback', () => {
  const b = browser();
  assert.equal(b.video.starts, 0);
  assert.equal(b.messages.at(-1).ready, true);
  assert.equal(b.messages.at(-1).playing, false);
});

test('explicit pause cancels pending play without a false decoder failure', async () => {
  const b = browser();
  b.player.play(); b.player.pause(); await flush();
  assert.equal(b.video.paused, true);
  assert.equal(b.messages.some(m => m.error), false);
  assert.equal(b.messages.at(-1).playing, false);
});

test('backgrounding during pending playback pauses without a false failure', async () => {
  const b = browser();
  b.player.play(); b.document.hidden = true;
  b.events.get('visibilitychange')(); await flush();
  assert.equal(b.video.paused, true);
  assert.equal(b.messages.some(m => m.error), false);
  b.document.hidden = false; b.events.get('visibilitychange')();
  assert.equal(b.video.starts, 1, 'Resuming visibility must never restart video');
});

test('retiring an initializing document stops its media without false failure', async () => {
  const b = browser();
  b.player.play(); b.player.retire(); await flush();
  assert.equal(b.video.paused, true);
  assert.equal(b.messages.some(m => m.error), false);
});

test('an unsupported codec remains a real sanitized error', async () => {
  const b = browser({ playbackError: 'NotSupportedError' });
  b.player.play(); await flush();
  assert.equal(b.messages.at(-1).error, true);
  assert.equal(b.messages.at(-1).nonce, nonce);
  assert.equal(JSON.stringify(b.messages).includes('Private decoder detail'), false);
});
