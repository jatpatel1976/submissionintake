import fs from "node:fs/promises";
import path from "node:path";
import { QuoteSchema, QuoteSummarySchema } from "../schemas/quote.schema.js";
function getQuoteDir() {
    return process.env.QUOTE_DATA_DIR
        ? path.resolve(process.env.QUOTE_DATA_DIR)
        : path.resolve(import.meta.dirname, "../../src/data/quotes");
}
export async function saveQuote(quote) {
    const quoteDir = getQuoteDir();
    await fs.mkdir(quoteDir, { recursive: true });
    await fs.writeFile(path.join(quoteDir, `${quote.quoteId}.json`), JSON.stringify(quote, null, 2));
}
export async function getQuote(quoteId) {
    const quoteDir = getQuoteDir();
    const raw = await fs.readFile(path.join(quoteDir, `${quoteId}.json`), "utf-8");
    return QuoteSchema.parse(JSON.parse(raw));
}
function summarizeQuote(quote) {
    return QuoteSummarySchema.parse({
        quoteId: quote.quoteId,
        status: quote.status,
        createdAt: quote.createdAt,
        productType: quote.productType,
        insuredName: quote.insured.name,
        brokerName: quote.broker?.name,
        classOfBusiness: quote.risk.classOfBusiness
    });
}
export async function listQuotes(productType) {
    const quoteDir = getQuoteDir();
    await fs.mkdir(quoteDir, { recursive: true });
    const entries = await fs.readdir(quoteDir, { withFileTypes: true });
    const quotes = await Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
        const raw = await fs.readFile(path.join(quoteDir, entry.name), "utf-8");
        try {
            const parsed = QuoteSchema.safeParse(JSON.parse(raw));
            return parsed.success ? parsed.data : undefined;
        }
        catch {
            return undefined;
        }
    }));
    return quotes
        .filter((quote) => quote !== undefined)
        .filter((quote) => !productType || quote.productType === productType)
        .map(summarizeQuote)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function updateQuote(quoteId, patch) {
    const current = await getQuote(quoteId);
    const updated = QuoteSchema.parse({ ...current, ...patch });
    await saveQuote(updated);
    return updated;
}
