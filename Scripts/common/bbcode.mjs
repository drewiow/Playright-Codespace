export function customToBBCode(text) {
    if (!text) return "";

    let output = text;

    // ✅ NORMALISE ALL NEWLINES FIRST (THIS IS THE FIX)
    output = output
        .replace(/\\n/g, "\n")     // env-style
        .replace(/\r\n/g, "\n")    // Windows
        .replace(/\r/g, "\n");     // stray CR

    // ✅ Bold
    output = output.replace(/#(.*?)#/g, "[b]$1[/b]");

    // ✅ Lists
    output = output.replace(/^\s*-\s*(.*)$/gm, "[.]$1");

    // ✅ Convert line breaks LAST
    output = output.replace(/\n/g, "[br]");

    return output.trim();
}
