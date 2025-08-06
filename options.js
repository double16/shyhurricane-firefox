const form = document.getElementById("opts");
const urlField = document.getElementById("mcp-url");
const domField = document.getElementById("domains");
const statusLbl = document.getElementById("status");

// Load saved values
browser.storage.local.get(["mcpServerUrl", "domainsInScope"]).then(({mcpServerUrl, domainsInScope}) => {
    if (mcpServerUrl) urlField.value = mcpServerUrl;
    if (domainsInScope) domField.value = domainsInScope.join(",");
});

form.addEventListener("submit", evt => {
    evt.preventDefault();
    const mcpUrl = urlField.value.trim();
    const domains = domField.value.split(",").map(s => s.trim()).filter(Boolean);

    browser.storage.local.set({
        mcpServerUrl: mcpUrl,
        domainsInScope: domains
    }).then(() => {
        statusLbl.textContent = "Saved!";
        setTimeout(() => statusLbl.textContent = "", 1500);
    });
});

if (typeof module !== 'undefined') module.exports = { saveForm, loadOptions };
