require('jest-webextension-mock');          // mocks global `browser`
const { shouldSkip, urlInScope, toKatanaHeaders, _setDomains } = require('../background');

describe('shouldSkip()', () => {
    test('skips binary-style content-types', () => {
        expect(shouldSkip('image/png')).toBe(true);      // non-SVG
        expect(shouldSkip('application/zip')).toBe(true);
        expect(shouldSkip('audio/wav')).toBe(true);
    });

    test('passes JSON/XML sub-types', () => {
        expect(shouldSkip('application/vnd.api+json')).toBe(false);
        expect(shouldSkip('application/soap+xml')).toBe(false);
    });

    test('passes plain text', () => {
        expect(shouldSkip('text/plain')).toBe(false);
    });
});

describe('urlInScope()', () => {
    beforeEach(() => {
        _setDomains(['internal.local']);
    });

    test('matches listed domain', () => {
        expect(urlInScope('https://api.internal.local/v1')).toBe(true);
    });

    test('rejects out-of-scope domain', () => {
        expect(urlInScope('https://example.com')).toBe(false);
    });

    test('rejects MCP server', () => {
        expect(urlInScope('http://localhost:8000/')).toBe(false);
    });
});

describe('toKatanaHeaders()', () => {
    test('converts names to lowercase_with_underscores', () => {
        const hdrs = [{ name: 'Content-Type', value: 'text/html' }];
        expect(toKatanaHeaders(hdrs)).toEqual({ 'content-type': 'text/html' });
    });

    test('concatenates duplicate names with ;', () => {
        const hdrs = [
            { name: 'Set-Cookie', value: 'foo=1' },
            { name: 'Set-Cookie', value: 'bar=2' }
        ];
        expect(toKatanaHeaders(hdrs)).toEqual({ 'set-cookie': 'foo=1;bar=2' });
    });
});
