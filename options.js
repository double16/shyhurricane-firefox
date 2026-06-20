const form = document.getElementById("opts");
const urlField = document.getElementById("mcp-url");
const domField = document.getElementById("domains");
const statusLbl = document.getElementById("status");

// Load saved values
browser.storage.local.get(["mcpServerUrl", "domainsInScope"]).then(({mcpServerUrl, domainsInScope}) => {
    if (urlField && mcpServerUrl !== undefined) urlField.value = mcpServerUrl;
    if (domField && domainsInScope !== undefined) domField.value = domainsInScope.join(",");
}).catch(err => console.error("Error loading options:", err));

if (form) {
    form.addEventListener("submit", evt => {
        evt.preventDefault();
        const mcpUrl = urlField ? urlField.value.trim() : "";
        const domains = domField ? domField.value.split(",").map(s => s.trim()).filter(Boolean) : [];

        browser.storage.local.set({
            mcpServerUrl: mcpUrl,
            domainsInScope: domains
        }).then(() => {
            if (statusLbl) statusLbl.textContent = "Saved!";
            setTimeout(() => {
                if (statusLbl) statusLbl.textContent = "";
            }, 1500);
        }).catch(err => {
            if (statusLbl) statusLbl.textContent = "Error saving!";
            console.error("Error saving options:", err);
        });
    });
}
