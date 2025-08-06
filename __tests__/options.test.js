require('jest-webextension-mock');                      // global `browser`
const { JSDOM } = require('jsdom');

const html = `<!DOCTYPE html><html><body>
  <form id="opts">
    <input id="mcp-url">
    <input id="domains">
    <span  id="status"></span>
  </form>
</body></html>`;

const dom  = new JSDOM(html);

global.window   = dom.window;
global.document = dom.window.document;

let saveForm, loadOptions, document;

beforeEach(() => {
    document = global.document = dom.window.document;
    if (!document.getElementById("opts")) {
        throw "Form not found";
    }

    browser.storage.local.clear();
    jest.resetModules();
    ({ saveForm, loadOptions } = require('../options'));
});

test('loadOptions populates form fields from storage', async () => {
    await browser.storage.local.set({
        mcpServerUrl: 'http://hub:9000',
        domainsInScope: ['a.com', 'b.com']
    });
    await loadOptions(); // normally called on load
    expect(document.getElementById('mcp-url').value).toBe('http://hub:9000');
    expect(document.getElementById('domains').value).toBe('a.com,b.com');
});

test('saveForm stores values on submit', async () => {
    document.getElementById('mcp-url').value = 'http://foo';
    document.getElementById('domains').value = 'one.com, two.com';

    await saveForm({ preventDefault(){} }); // fake event

    const stored = await browser.storage.local.get();
    expect(stored.mcpServerUrl).toBe('http://foo');
    expect(stored.domainsInScope).toEqual(['one.com', 'two.com']);
});
