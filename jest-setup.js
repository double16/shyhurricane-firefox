// Polyfill setImmediate for jsdom environment (used by _buildStream and test callbacks)
if (typeof global.setImmediate === 'undefined') {
    global.setImmediate = function (cb) {
        setTimeout(cb, 0);
    };
}

global._storageData = {};
global._fetchedUrls = [];
global._onChangedListeners = [];
global._requestCallbacks = {onBeforeRequest: [], onBeforeSendHeaders: [], onHeadersReceived: []};
global._mockStreamChunks = {};

function _buildStream(requestId) {
    var chunks = global._mockStreamChunks[requestId] || [];
    var totalLen = 0;
    var bufs = chunks.map(function (c) {
        return typeof c === 'string' ? Buffer.from(c, 'utf-8') : new Uint8Array(c);
    });
    bufs.forEach(function (b) {
        totalLen += b.length;
    });
    var combined = new Uint8Array(totalLen);
    var off = 0;
    bufs.forEach(function (b) {
        combined.set(b, off);
        off += b.length;
    });
    var _dataFired = false;
    var stream = {};
    Object.defineProperty(stream, 'ondata', {
        set: function (fn) {
            if (!_dataFired && fn) {
                _dataFired = true;
                fn({data: bufs.length ? combined : new Uint8Array()});
            }
        },
        writable: true
    });
    Object.defineProperty(stream, 'onstop', {
        set: function (fn) {
            if (fn) setImmediate(function () {
                fn();
            });
        },
        writable: true
    });
    stream.write = function () {
    };
    stream.disconnect = function () {
    };
    return stream;
}

global.browser = {
    storage: {
        local: {
            get: function () {
                return Promise.resolve(global._storageData);
            },
            onChanged: {
                addListener: function (fn) {
                    global._onChangedListeners.push(fn);
                },
                removeListener: function (fn) {
                    var i = global._onChangedListeners.indexOf(fn);
                    if (i >= 0) global._onChangedListeners.splice(i, 1);
                },
                trigger: function (changes) {
                    global._onChangedListeners.forEach(function (l) {
                        l(changes);
                    });
                }
            }
        },
    },
    webRequest: {
        onBeforeRequest: {
            addListener: function (cb, filter, extraInfo) {
                global._requestCallbacks.onBeforeRequest.push({cb: cb, filter: filter, extraInfo: extraInfo});
            }
        },
        onBeforeSendHeaders: {
            addListener: function (cb, filter, extraInfo) {
                global._requestCallbacks.onBeforeSendHeaders.push({cb: cb, filter: filter, extraInfo: extraInfo});
            }
        },
        onHeadersReceived: {
            addListener: function (cb, filter, extraInfo) {
                global._requestCallbacks.onHeadersReceived.push({cb: cb, filter: filter, extraInfo: extraInfo});
            }
        },
        filterResponseData: _buildStream
    }
};

global.fetch = async function (url, opts) {
    global._fetchedUrls.push({url: url, body: opts && opts.body});
    return new Response('{}', {status: 200});
};
