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
                    args: "",
                    raw
                };
            }

            return {
                command: raw.slice(0, firstSpace).toLowerCase(),
                args: raw.slice(firstSpace + 1).trim(),
                raw
            };
        });
}

export function resolveCsvTokens(text, row) {
    if (!text) return text;

    return text.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (_, key) => {
            // Case‑insensitive lookup
            const foundKey = Object.keys(row).find(
                k => k.toLowerCase() === key.toLowerCase()
            );

            if (!foundKey) {
                log?.(`⚠️ Advanced token not found in CSV: ${key}`);
                return `{{${key}}}`;
            }

            // Convert to string defensively
            return String(row[foundKey] ?? "");
        }
    );
}