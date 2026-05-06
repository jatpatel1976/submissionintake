import fs from "node:fs/promises";
import path from "node:path";
import { ProductType } from "../schemas/common.schema.js";
import { Quote, QuoteSchema, QuoteSummary, QuoteSummarySchema, UnderwriterAllocation } from "../schemas/quote.schema.js";

type UnderwriterProfile = Omit<UnderwriterAllocation, "allocatedAt" | "rationale"> & {
  specialties: string[];
};

const UNDERWRITERS: UnderwriterProfile[] = [
  {
    name: "Maya Desai",
    team: "Property Owners",
    email: "maya.desai@internal-underwriting.example",
    specialties: ["property_owners", "property", "real estate", "landlord"]
  },
  {
    name: "Oliver Hart",
    team: "Commercial Combined",
    email: "oliver.hart@internal-underwriting.example",
    specialties: ["generic_commercial", "commercial combined", "manufacturing", "engineering"]
  },
  {
    name: "Priya Shah",
    team: "Technical Referrals",
    email: "priya.shah@internal-underwriting.example",
    specialties: ["referral", "missing", "warning", "complex"]
  }
];

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

function summarizeQuote(quote: Quote): QuoteSummary {
  return QuoteSummarySchema.parse({
    quoteId: quote.quoteId,
    status: quote.status,
    createdAt: quote.createdAt,
    productType: quote.productType,
    ...(quote.underwriter ? { underwriterName: quote.underwriter.name } : {}),
    insuredName: quote.insured.name,
    brokerName: quote.broker?.name,
    classOfBusiness: quote.risk.classOfBusiness
  });
}

function allocateUnderwriter(quote: Quote): UnderwriterAllocation {
  if (quote.underwriter) return quote.underwriter;

  const classOfBusiness = quote.risk.classOfBusiness?.toLowerCase() ?? "";
  const hasReferralSignals = quote.dataQuality.missingFields.length > 2 || quote.dataQuality.warnings.length > 1;
  const matched = UNDERWRITERS.find((underwriter) =>
    underwriter.specialties.some((specialty) =>
      specialty === quote.productType || classOfBusiness.includes(specialty)
    )
  ) ?? (hasReferralSignals ? UNDERWRITERS[2] : UNDERWRITERS[1]);

  const rationale = hasReferralSignals
    ? "Allocated for underwriting review with data-quality referral points."
    : `Allocated based on ${quote.risk.classOfBusiness ?? quote.productType} appetite.`;

  return {
    name: matched.name,
    team: matched.team,
    email: matched.email,
    allocatedAt: new Date().toISOString(),
    rationale
  };
}

export async function listQuotes(productType?: ProductType): Promise<QuoteSummary[]> {
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
      } catch {
        return undefined;
      }
    }));

  return quotes
    .filter((quote): quote is Quote => quote !== undefined)
    .filter((quote) => !productType || quote.productType === productType)
    .map(summarizeQuote)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateQuote(quoteId: string, patch: Partial<Quote>): Promise<Quote> {
  const current = await getQuote(quoteId);
  const candidate = QuoteSchema.parse({ ...current, ...patch });
  const updated = QuoteSchema.parse({
    ...candidate,
    underwriter: candidate.status === "In Review" ? allocateUnderwriter(candidate) : candidate.underwriter
  });
  await saveQuote(updated);
  return updated;
}
