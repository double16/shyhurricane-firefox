describe('options.js', () => {
    let originalConsoleError;

    beforeEach(() => {
        // Mock console.error to suppress it from output during tests
        originalConsoleError = console.error;
        console.error = jest.fn();

        // Set up our document body
        document.body.innerHTML = `
      <form id="opts">
        <input type="text" id="mcp-url" />
        <input type="text" id="domains" />
        <div id="status"></div >
      </form>
    `;

        // Mock browser API
        global.browser = {
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({}),
                    set: jest.fn().mockResolvedValue({})
                }
            }
        };

        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllMocks();
        console.error = originalConsoleError;
        jest.useRealTimers();
    });

    // Helper to wait for all pending promises (microtasks)
    async function flushMicrotasks() {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    }

    test('should load saved values', async () => {
        const mcpServerUrl = 'https://example.com';
        const domainsInScope = ['example.com', 'test.org'];

        global.browser.storage.local.get.mockResolvedValue({mcpServerUrl, domainsInScope});

        jest.isolateModules(() => {
            require('../options.js');
        });

        await flushMicrotasks();

        expect(document.getElementById('mcp-url').value).toBe(mcpServerUrl);
        expect(document.getElementById('domains').value).toBe('example.com,test.org');
    });

    test('should load an empty string for mcpServerUrl', async () => {
        const mcpServerUrl = '';
        const domainsInScope = ['example.com'];

        global.browser.storage.local.get.mockResolvedValue({mcpServerUrl, domainsInScope});

        document.getElementById('mcp-url').value = 'default';

        jest.isolateModules(() => {
            require('../options.js');
        });

        await flushMicrotasks();

        expect(document.getElementById('mcp-url').value).toBe('');
    });

    test('should save values when form is submitted', async () => {
        jest.isolateModules(() => {
            require('../options.js');
        });

        await flushMicrotasks();

        const urlField = document.getElementById('mcp-url');
        const domField = document.getElementById('domains');
        const form = document.getElementById('opts');
        const statusLbl = document.getElementById('status');

        urlField.value = 'https://new-url.com';
        domField.value = 'new1.com, new2.com ';

        const event = new Event('submit', {cancelable: true});
        form.dispatchEvent(event);

        // Wait for the saving promise to resolve
        await flushMicrotasks();

        expect(global.browser.storage.local.set).toHaveBeenCalledWith({
            mcpServerUrl: 'https://new-url.com',
            domainsInScope: ['new1.com', 'new2.com']
        });
        expect(statusLbl.textContent).toBe('Saved!');

        // Now advance timers to check the timeout
        jest.advanceTimersByTime(1500);
        expect(statusLbl.textContent).toBe('');
    });

    test('should handle errors during loading', async () => {
        global.browser.storage.local.get.mockRejectedValue(new Error('Load failed'));

        jest.isolateModules(() => {
            require('../options.js');
        });

        await flushMicrotasks();

        expect(console.error).toHaveBeenCalledWith("Error loading options:", expect.any(Error));
    });

    test('should handle errors during saving', async () => {
        jest.isolateModules(() => {
            require('../options.js');
        });

        await flushMicrotasks();

        global.browser.storage.local.set.mockRejectedValue(new Error('Save failed'));

        const form = document.getElementById('opts');
        const statusLbl = document.getElementById('status');
        const event = new Event('submit', {cancelable: true});
        form.dispatchEvent(event);

        await flushMicrotasks();

        expect(statusLbl.textContent).toBe('Error saving!');
        expect(console.error).toHaveBeenCalledWith("Error saving options:", expect.any(Error));
    });
});
