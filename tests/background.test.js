/**
 * Unit tests for background.js (Firefox WebExtension)
 * Runs in Node with Jest. global.browser is auto-mocked by jest-setup.js.
 */

var bg = require('../background');

/* ================================================================ */
/*  shouldSkip(contentType)                                           */
/* ================================================================ */

describe('shouldSkip', function () {
    var skip = bg.shouldSkip;

    it('keeps application/json', function () {
        expect(skip('application/json')).toBe(false);
    });

    it('keeps JSON with charset annotation', function () {
        expect(skip('application/json; charset=utf-8')).toBe(false);
    });

    it('keeps +json vendor types', function () {
        expect(skip('application/merge-patch+json')).toBe(false);
        expect(skip('application/vnd.api+json')).toBe(false);
    });

    it('keeps +xml vendor types', function () {
        expect(skip('application/problem+xml')).toBe(false);
    });

    it('skips audio/* prefix', function () {
        expect(skip('audio/mpeg')).toBe(true);
        expect(skip('audio/ogg')).toBe(true);
    });

    it('skips video/* prefix', function () {
        expect(skip('video/mp4')).toBe(true);
    });

    it('skips font/* prefix', function () {
        expect(skip('font/woff2')).toBe(true);
    });

    it('skips binary/* prefix', function () {
        expect(skip('binary/octet-stream')).toBe(true);
    });

    it('skips image/* except svg', function () {
        expect(skip('image/png')).toBe(true);
        expect(skip('image/jpeg')).toBe(true);
        expect(skip('image/gif')).toBe(true);
        expect(skip('image/webp')).toBe(true);
    });

    it('keeps image/svg+xml', function () {
        expect(skip('image/svg+xml')).toBe(false);
    });

    it('skips known binary application types', function () {
        expect(skip('application/octet-stream')).toBe(true);
        expect(skip('application/pdf')).toBe(true);
        expect(skip('application/x-pdf')).toBe(true);
        expect(skip('application/zip')).toBe(true);
        expect(skip('application/x-zip-compressed')).toBe(true);
        expect(skip('application/x-protobuf')).toBe(true);
        expect(skip('application/font-woff')).toBe(true);
        expect(skip('application/font-woff2')).toBe(true);
        expect(skip('application/vnd.ms-fontobject')).toBe(true);
    });

    it('handles null / undefined / empty string', function () {
        expect(skip(null)).toBe(false);
        expect(skip(undefined)).toBe(false);
        expect(skip('')).toBe(false);
    });

    it('is case-insensitive for prefixes', function () {
        expect(skip('Audio/Mpeg')).toBe(true);
        expect(skip('IMAGE/PNG')).toBe(true);
    });

    it('keeps unknown text-like types', function () {
        expect(skip('text/html')).toBe(false);
        expect(skip('text/plain')).toBe(false);
        expect(skip('application/xml')).toBe(false);
    });
});

/* ================================================================ */
/*  toKatanaHeaders(arr[])                                             */
/* ================================================================ */

describe('toKatanaHeaders', function () {
    var convert = bg.toKatanaHeaders;

    it('converts a single header correctly', function () {
        expect(convert([{name: 'Content-Type', value: 'application/json'}])).toEqual({
            content_type: 'application/json'
        });
    });

    it('lowercases keys and replaces hyphens with underscores', function () {
        expect(convert([{name: 'X-Custom-Header', value: 'foo'}])).toEqual({
            x_custom_header: 'foo'
        });
    });

    it('concatenates duplicate header names with semicolons', function () {
        var arr = [
            {name: 'Accept', value: 'text/html'},
            {name: 'Accept', value: 'application/json'}
        ];
        expect(convert(arr)).toEqual({accept: 'text/html;application/json'});
    });

    it('returns empty object for empty array', function () {
        expect(convert([])).toEqual({});
    });

    it('handles three or more duplicates', function () {
        var arr = [
            {name: 'Set-Cookie', value: 'a=1'},
            {name: 'Set-Cookie', value: 'b=2'},
            {name: 'Set-Cookie', value: 'c=3'}
        ];
        expect(convert(arr)).toEqual({set_cookie: 'a=1;b=2;c=3'});
    });

    it('handles multiple distinct headers', function () {
        var arr = [
            {name: 'Content-Type', value: 'application/json'},
            {name: 'X-Request-ID', value: 'abc123'},
            {name: 'Accept-Encoding', value: 'gzip, deflate'}
        ];
        expect(convert(arr)).toEqual({
            content_type: 'application/json',
            x_request_id: 'abc123',
            accept_encoding: 'gzip, deflate'
        });
    });
});

/* ================================================================ */
/*  cleanup(id)                                                        */
/* ================================================================ */

describe('cleanup', function () {
    var bgClean;

    beforeEach(function () {
        bgClean = bg;       // reuse the initial import
        Object.keys(bgClean.getRequests()).forEach(function (k) {
            delete bgClean.getRequests()[k];
        });
        Object.keys(bgClean.getRequestHeaders()).forEach(function (k) {
            delete bgClean.getRequestHeaders()[k];
        });
    });

    it('removes matching entries from both maps', function () {
        bgClean.getRequests()['req1'] = {method: 'GET'};
        bgClean.getRequestHeaders()['req1'] = [{name: 'Host', value: 'example.com'}];

        bgClean.cleanup('req1');

        expect(bgClean.getRequests()).not.toHaveProperty('req1');
        expect(bgClean.getRequestHeaders()).not.toHaveProperty('req1');
    });

    it('does not remove unrelated entries', function () {
        bgClean.getRequests()['req1'] = 'payload';
        bgClean.getRequests()['req2'] = 'other';
        bgClean.getRequestHeaders()['req1'] = ['h'];
        bgClean.getRequestHeaders()['req2'] = ['h2'];

        bgClean.cleanup('req1');

        expect(Object.keys(bgClean.getRequests())).toEqual(['req2']);
        expect(bgClean.getRequestHeaders()).toHaveProperty('req2');
    });

    it('is safe to call for non-existent id', function () {
        expect(function () {
            bgClean.cleanup('nonexistent');
        }).not.toThrow();
    });

    it('starts with empty state', function () {
        expect(bgClean.getRequests()).toEqual({});
        expect(bgClean.getRequestHeaders()).toEqual({});
    });
});

/* ================================================================ */
/*  urlInScope(url)                                                    */

/* ================================================================ */

function reloadBackground(storageData) {
    jest.resetModules();
    require('../jest-setup');    // Re-init mocks after resetModule clears them
    global._onChangedListeners.length = 0;
    global._storageData = storageData || {};
    var bg = require('../background');
    bg._setConfig(storageData || {});
    return bg;
}

describe('urlInScope', function () {
    var bgScoped;

    beforeEach(function (done) {
        bgScoped = reloadBackground({});
        setImmediate(done);
    });

    it('keeps external URLs when no domain filter', function () {
        expect(bgScoped.urlInScope('https://example.com/foo')).toBe(true);
        expect(bgScoped.urlInScope('http://test.local/api/users')).toBe(true);
    });

    it('excludes the MCP server URL itself', function () {
        expect(bgScoped.urlInScope('http://localhost:8000')).toBe(false);
        expect(bgScoped.urlInScope('http://localhost:8000/index')).toBe(false);
    });

    it('keeps URLs on different host or port', function () {
        expect(bgScoped.urlInScope('http://localhost:8001/other')).toBe(true);
    });

    it('handles invalid URL strings gracefully', function () {
        // Not MCP URL, no domain filter but new URL() throws for 'not-a-url'
        // When DOMAINS_IN_SCOPE is non-empty + bad URL -> false caught in catch block
        expect(bgScoped.urlInScope('not-a-url')).toBe(false);
    });
});

describe('urlInScope with domain filter', function () {
    var bgFilter;

    beforeEach(function (done) {
        bgFilter = reloadBackground({domainsInScope: ['.example.com']});
        setImmediate(done);
    });

    it('matches the exact domain', function () {
        expect(bgFilter.urlInScope('https://example.com/page')).toBe(true);
    });

    it('matches subdomains', function () {
        expect(bgFilter.urlInScope('https://sub.example.com/api')).toBe(true);
    });

    it('rejects unmatched hosts', function () {
        expect(bgFilter.urlInScope('https://other-site.net/data')).toBe(false);
    });

    it('excludes MCP server regardless of domain filter', function () {
        expect(bgFilter.urlInScope('http://localhost:8000/index')).toBe(false);
    });
});

/* ================================================================ */
/*  Storage persistence lifecycle                                     */
/* ================================================================ */

describe('storage lifecycle', function () {

    it('loads persisted settings on module init', function () {
        var loaded = reloadBackground({
            mcpServerUrl: 'https://mcp.example.com',
            domainsInScope: ['.example.com']
        });

        expect(loaded.urlInScope('https://example.com/x')).toBe(true);
        expect(loaded.urlInScope('https://other.net')).toBe(false);
        expect(loaded.urlInScope('https://mcp.example.com/index')).toBe(false);
    });

    it('reacts to storage onChanged events', function () {
        var mod = reloadBackground({});

        // Simulate live storage change via onChanged trigger
        global.browser.storage.local.onChanged.trigger({
            mcpServerUrl: {newValue: 'http://new-server.local:9000'},
            domainsInScope: {newValue: ['.newserv.com']}
        });

        expect(mod.urlInScope('https://newserv.com/ok')).toBe(true);
        expect(mod.urlInScope('https://other.org')).toBe(false);
    });

    it('MCP_SERVER_URL updates exclude new server URL', function () {
        var mod = reloadBackground({});

        global.browser.storage.local.onChanged.trigger({
            mcpServerUrl: {newValue: 'http://custom.server.com:9999'}
        });

        expect(mod.urlInScope('http://custom.server.com:9999/index')).toBe(false);
        expect(mod.urlInScope('http://other.net/page')).toBe(true);
    });

    it('domainsInScope onChanged with falsy newValue keeps prior config', function () {
        var mod = reloadBackground({mcpServerUrl: 'http://localhost:8000'});

        global.browser.storage.local.onChanged.trigger({
            domainsInScope: {newValue: null}    // falsy -> default to []
        });

        expect(mod.urlInScope('https://anyhost.com')).toBe(true);  // no filter, so all in scope
    });
});
