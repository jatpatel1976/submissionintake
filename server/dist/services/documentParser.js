import fs from "node:fs/promises";
import path from "node:path";
export async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (![".txt", ".md"].includes(ext)) {
        return `Unsupported binary parser for ${ext}. Prototype currently supports .txt and .md files.`;
    }
    return fs.readFile(filePath, "utf-8");
}
