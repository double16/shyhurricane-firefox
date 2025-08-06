require('jest-webextension-mock'); // gives us `global.browser`

browser.webRequest = {
    onBeforeRequest:    { addListener: jest.fn() },
    onBeforeSendHeaders:{ addListener: jest.fn() },
    onHeadersReceived:  { addListener: jest.fn() },
    filterResponseData: jest.fn().mockReturnValue({
        ondata: null,
        onstop: null,
        write: jest.fn(),
        disconnect: jest.fn()
    })
};

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
