import fs from "node:fs/promises";
import path from "node:path";
import { Quote, QuoteSchema } from "../schemas/quote.schema.js";

function getQuoteDir(): string {
  return process.env.QUOTE_DATA_DIR
    ? path.resolve(process.env.QUOTE_DATA_DIR)
    : path.resolve(import.meta.dirname, "../../src/data/quotes");
}

export async function saveQuote(quote: Quote): Promise<void> {
  const quoteDir = getQuoteDir();
  await fs.mkdir(quoteDir, { recursive: true });
  await fs.writeFile(path.join(quoteDir, `${quote.quoteId}.json`), JSON.stringify(quote, null, 2));
}

export async function getQuote(quoteId: string): Promise<Quote> {
  const quoteDir = getQuoteDir();
  const raw = await fs.readFile(path.join(quoteDir, `${quoteId}.json`), "utf-8");
  return QuoteSchema.parse(JSON.parse(raw));
}

export async function updateQuote(quoteId: string, patch: Partial<Quote>): Promise<Quote> {
  const current = await getQuote(quoteId);
  const updated = QuoteSchema.parse({ ...current, ...patch });
  await saveQuote(updated);
  return updated;
}
