// Configuration
let DOMAINS_IN_SCOPE = [];
let MCP_SERVER_URL = "http://localhost:8000";
const INDEX_PATH = "/index";

// Load persisted settings  */
browser.storage.local.get(["mcpServerUrl", "domainsInScope"]).then(items => {
    if (items.mcpServerUrl) MCP_SERVER_URL = items.mcpServerUrl;
    if (items.domainsInScope) DOMAINS_IN_SCOPE = items.domainsInScope;
    console.info(`storage loaded: MCP_SERVER_URL=${MCP_SERVER_URL}, DOMAINS_IN_SCOPE=${DOMAINS_IN_SCOPE}`);
});

/*  Listen for live updates (no reload needed)  */
browser.storage.local.onChanged.addListener(changes => {
    if (changes.mcpServerUrl)
        MCP_SERVER_URL = changes.mcpServerUrl.newValue || MCP_SERVER_URL;
    if (changes.domainsInScope)
        DOMAINS_IN_SCOPE = changes.domainsInScope.newValue || [];
    console.info(`storage changed: MCP_SERVER_URL=${MCP_SERVER_URL}, DOMAINS_IN_SCOPE=${DOMAINS_IN_SCOPE}`);
});

// Skip rules
const SKIP_PREFIXES = ["audio/", "video/", "font/", "binary/"];
const SKIP_TYPES = new Set([
    "application/octet-stream",
    "application/pdf",
    "application/x-pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-protobuf",
    "application/font-woff",
    "application/font-woff2",
    "application/vnd.ms-fontobject"
]);

// Helper functions
function urlInScope(url) {
    if (url.toString().startsWith(MCP_SERVER_URL)) return false;
    if (DOMAINS_IN_SCOPE.length === 0) return true;
    try {
        const host = new URL(url).hostname;
        return DOMAINS_IN_SCOPE.some(d => host.endsWith(d));
    } catch {
        return false;
    }
}

function shouldSkip(ct) {
    if (!ct) return false;
    const lower = ct.toLowerCase();
    if (lower.includes("+json") || lower.includes("+xml")) return false;
    if (SKIP_PREFIXES.some(p => lower.startsWith(p))) return true;
    if (lower.startsWith("image/") && !lower.includes("svg")) return true;
    return SKIP_TYPES.has(lower);
}

function toKatanaHeaders(arr) {
    const out = {};
    for (const h of arr) {
        const k = h.name.toLowerCase();
        out[k] = out[k] ? `${out[k]};${h.value}` : h.value;
    }
    return out;
}

// State stores
const requests = {};   // requestId -> {method,url,body}
const requestHeaders = {};   // requestId -> header array

function cleanup(id) {
    delete requests[id];
    delete requestHeaders[id];
}

// Listeners
const filter = {urls: ["<all_urls>"]};

// Capture body & URL/method
browser.webRequest.onBeforeRequest.addListener(
    details => {
        if (!urlInScope(details.url)) return;
        console.debug(`shyhurricane onBeforeRequest: ${details.requestId}, ${details.url}`);
        const body = details.requestBody?.raw?.[0]?.bytes;
        requests[details.requestId] = {
            method: details.method,
            endpoint: details.url,
            body: body ? new TextDecoder("utf-8").decode(body) : undefined
        };
    },
    filter,
    ["requestBody"]
);

// Capture request headers
browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
        if (!requests[details.requestId]) return;
        console.debug(`shyhurricane onBeforeSendHeaders: ${details.requestId}`);
        requestHeaders[details.requestId] = details.requestHeaders;
    },
    filter,
    ["requestHeaders"]
);

// Capture response, body & ship to MCP
browser.webRequest.onHeadersReceived.addListener(
    details => {
        if (!requests[details.requestId]) return;
        console.debug(`shyhurricane onHeadersReceived: ${details.requestId}`);

        const ct = details.responseHeaders.find(h => h.name.toLowerCase() === "content-type")?.value;
        if (shouldSkip(ct)) {
            cleanup(details.requestId);
            return;
        }

        const stream = browser.webRequest.filterResponseData(details.requestId);
        const chunks = [];
        stream.ondata = e => {
            chunks.push(e.data);
            stream.write(e.data);
        };
        stream.onstop = () => {
            stream.disconnect();
            let responseBody;
            try {
                const size = chunks.reduce((n, c) => n + c.byteLength, 0);
                const buf = new Uint8Array(size);
                let off = 0;
                for (const c of chunks) {
                    buf.set(new Uint8Array(c), off);
                    off += c.byteLength;
                }
                responseBody = new TextDecoder("utf-8").decode(buf);
            } catch { /* binary or bad UTF-8 */
            }

            const entry = {
                timestamp: new Date().toISOString(),
                request: {
                    method: requests[details.requestId].method,
                    endpoint: requests[details.requestId].endpoint,
                    headers: toKatanaHeaders(requestHeaders[details.requestId] || []),
                    body: requests[details.requestId].body
                },
                response: {
                    status_code: details.statusCode,
                    headers: toKatanaHeaders(details.responseHeaders),
                    body: responseBody
                }
            };

            fetch(MCP_SERVER_URL + INDEX_PATH, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(entry)
            }).catch(err => console.error("[ShyHurricane]", err));

            cleanup(details.requestId);
        };
    },
    filter,
    ["blocking", "responseHeaders"]
);

if (typeof module !== 'undefined')
  module.exports = {
        shouldSkip,
        urlInScope,
        toKatanaHeaders,
        _setDomains: d => (DOMAINS_IN_SCOPE = d)
      };
