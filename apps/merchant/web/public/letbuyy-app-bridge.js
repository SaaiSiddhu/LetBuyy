(function () {
  var context = null;
  var pending = {};
  var sequence = 0;
  var readyResolved = false;
  var readyCallbacks = [];
  var readyInterval = null;

  function nextRequestId() {
    sequence += 1;
    return 'lb_bridge_' + sequence;
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function resolveReady(payload) {
    context = payload || {};
    readyResolved = true;
    if (readyInterval) {
      window.clearInterval(readyInterval);
      readyInterval = null;
    }
    while (readyCallbacks.length > 0) {
      var callback = readyCallbacks.shift();
      callback(context);
    }
    emit('letbuyy:bridge:ready', context);
  }

  function post(type, payload, requestId) {
    window.parent.postMessage({
      type: type,
      requestId: requestId,
      payload: payload || {},
    }, '*');
  }

  function ready() {
    if (readyResolved) return Promise.resolve(context);
    return new Promise(function (resolve) {
      readyCallbacks.push(resolve);
      sendReadySignal();
    });
  }

  function sendReadySignal() {
    if (readyResolved) return;
    post('letbuyy:bridge.ready');
    if (readyInterval) return;
    readyInterval = window.setInterval(function () {
      if (readyResolved) return;
      post('letbuyy:bridge.ready');
    }, 500);
  }

  function request(input) {
    var requestId = nextRequestId();
    post('letbuyy:bridge.api.request', input || {}, requestId);

    return new Promise(function (resolve, reject) {
      pending[requestId] = { resolve: resolve, reject: reject };
      window.setTimeout(function () {
        if (!pending[requestId]) return;
        delete pending[requestId];
        reject(new Error('LetBuyy App Bridge request timed out'));
      }, 15000);
    });
  }

  function toast(message, tone) {
    post('letbuyy:bridge.toast', {
      message: String(message || 'App notification'),
      tone: tone || 'info',
    });
  }

  function resize(height) {
    post('letbuyy:bridge.resize', {
      height: height || document.documentElement.scrollHeight || document.body.scrollHeight,
    });
  }

  window.addEventListener('message', function (event) {
    var message = event.data || {};
    if (typeof message.type !== 'string' || message.type.indexOf('letbuyy:bridge.') !== 0) return;

    if (message.type === 'letbuyy:bridge.context') {
      resolveReady(message.payload);
      return;
    }

    if (message.type === 'letbuyy:bridge.api.response') {
      var pendingRequest = pending[message.requestId];
      if (!pendingRequest) return;
      delete pending[message.requestId];

      if (message.payload && message.payload.ok === false) {
        pendingRequest.reject(new Error(message.payload.error || 'LetBuyy App Bridge request failed'));
        return;
      }

      pendingRequest.resolve(message.payload);
    }
  });

  window.LetBuyyAppBridge = {
    ready: ready,
    request: request,
    toast: toast,
    resize: resize,
  };

  sendReadySignal();
})();
