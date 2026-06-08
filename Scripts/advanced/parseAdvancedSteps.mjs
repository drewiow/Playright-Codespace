// automation/advanced/parseAdvancedSteps.js

export function parseAdvancedSteps(text) {
    if (!text || typeof text !== "string") {
        return [];
    }

    return text
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(raw => {
            const firstSpace = raw.indexOf(" ");
            if (firstSpace === -1) {
                return {
                    command: raw.toLowerCase(),
                    args: [],
                    raw
                };
            }

            return {
                command: raw.slice(0, firstSpace).toLowerCase(),
                args: raw.slice(firstSpace + 1).trim().split(/\s+/),
                raw
            };
        });
}

export function resolveCsvTokens(text, row, log = console.log) {
    if (!text) return text;

    function normaliseKey(key) {
        return key.toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    return text.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (_, key) => {

            const normalizedToken = normaliseKey(key);

            const foundKey = Object.keys(row).find(
                k => normaliseKey(k) === normalizedToken
            );

            if (!foundKey) {
                log?.(`⚠️ Advanced token not found in CSV: ${key}`);
                return `{{${key}}}`;
            }

            return String(row[foundKey] ?? "");
        }
    );
}