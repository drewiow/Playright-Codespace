// csvValidationHelper.mjs
import fs from "fs";

/** Basic email check (practical, not full RFC) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * validateRow
 * @param {Object} row - parsed CSV row (keys are header names)
 * @param {Object} opts - { requiredFields: string[], allowDomains: string[]|null, blockDomains: string[]|null, customChecks: ((row)=>string|null)[] }
 * @returns {string[]} - list of failure reasons (empty = valid)
 */
export function validateRow(row, opts = {}) {
    const failures = [];
    const required = opts.requiredFields || [];

    // Required fields
    for (const f of required) {
        const v = (row[f] ?? "").toString().trim();
        if (!v) failures.push(`Missing required field: ${f}`);
    }

    // Email checks (if email column exists)
    if ("email" in row) {
        const email = (row.email ?? "").toString().trim();
        if (!email) {
            failures.push("Email is blank");
        } else if (!isValidEmail(email)) {
            failures.push(`Invalid email: ${email}`);
        } else {
            // domain allow/block checks as before
            const domain = email.split("@")[1].toLowerCase();
            if (opts.allowDomains && opts.allowDomains.length > 0) {
                if (!opts.allowDomains.map(d => d.toLowerCase()).includes(domain)) {
                    failures.push(`Email domain not allowed: ${domain}`);
                }
            }
            if (opts.blockDomains && opts.blockDomains.length > 0) {
                if (opts.blockDomains.map(d => d.toLowerCase()).includes(domain)) {
                    failures.push(`Email domain blocked: ${domain}`);
                }
            }
        }
    }

    // Example phone sanity check (if phone column exists)
    if ("phone" in row) {
        const phone = (row.phone ?? "").toString().trim();
        if (phone && !/^[\d+\-\s()]{6,20}$/.test(phone)) {
            failures.push(`Suspicious phone format: ${phone}`);
        }
    }

    // Custom checks
    if (Array.isArray(opts.customChecks)) {
        for (const check of opts.customChecks) {
            try {
                const msg = check(row);
                if (msg) failures.push(msg);
            } catch (err) {
                failures.push(`Custom check error: ${err.message}`);
            }
        }
    }

    return failures;
}

// stricter email validation
export function isValidEmail(email) {
    if (!email || typeof email !== "string") return false;

    // quick rejects
    if (/\s/.test(email)) return false; // no spaces
    if (/['"(),:;<>\\\/\[\]]/.test(email)) return false; // disallowed punctuation

    // basic allowed pattern (local@domain). This is intentionally stricter than full RFC.
    const basicRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!basicRe.test(email)) return false;

    const [local, domain] = email.split("@");
    if (!local || !domain) return false;

    // length limits
    if (local.length > 64) return false;
    if (domain.length > 255) return false;

    // local part rules
    if (local.startsWith(".") || local.endsWith(".")) return false;
    if (local.includes("..")) return false;

    // domain rules: no consecutive dots, labels not empty, labels not start/end with hyphen
    if (domain.includes("..")) return false;
    const labels = domain.split(".");
    for (const lbl of labels) {
        if (lbl.length === 0) return false;
        if (lbl.startsWith("-") || lbl.endsWith("-")) return false;
        if (!/^[A-Za-z0-9-]+$/.test(lbl)) return false;
    }

    return true;
}

/**
 * writeFailuresCsv
 * Writes a CSV with columns: each input header, reason
 * @param {Array<{row:Object, reasons:string[]}>} failures
 * @param {string} outPath
 */
export function writeFailuresCsv(failures, outPath) {
    if (!Array.isArray(failures) || failures.length === 0) return;

    // Collect all headers from first row (preserve input headers order if possible)
    const headers = Object.keys(failures[0].row);
    const headerLine = [...headers, "reason"].join(",") + "\n";

    const lines = failures.map(f => {
        const values = headers.map(h => {
            const v = f.row[h] ?? "";
            // escape quotes and wrap in quotes
            return `"${String(v).replace(/"/g, '""')}"`;
        });
        const reason = `"${f.reasons.join("; ").replace(/"/g, '""')}"`;
        return [...values, reason].join(",");
    });

    fs.writeFileSync(outPath, headerLine + lines.join("\n") + "\n", "utf8");
}