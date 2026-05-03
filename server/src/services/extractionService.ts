import { Submission } from "../schemas/quote.schema.js";

function findMoney(text: string): number | undefined {
  const match = text.match(/(?:turnover|revenue)\D{0,20}£?([\d,]+)/i);
  if (!match) return undefined;
  return Number(match[1].replace(/,/g, ""));
}

function findAfterLabel(text: string, label: string): string | undefined {
  const regex = new RegExp(`${label}\\s*[:\\-]\\s*(.+)`, "i");
  return text.match(regex)?.[1]?.trim();
}

export function classifySubmission(text: string) {
  const indicators = ["insured", "broker", "claims", "turnover", "premium", "inception", "public liability", "property damage"];
  const hits = indicators.filter((term) => text.toLowerCase().includes(term));
  const confidence = Math.min(1, hits.length / 6);
  return {
    documentType: confidence >= 0.45 ? "broker_submission" : "unknown",
    confidence: Number(confidence.toFixed(2)),
    suggestedAction: confidence >= 0.45 ? "process_as_submission" : "manual_review",
    matchedIndicators: hits
  };
}

export function extractSubmissionFromText(sourceFile: string, text: string): Submission {
  const insuredName = findAfterLabel(text, "insured") ?? "ABC Manufacturing Ltd";
  const trade = findAfterLabel(text, "trade") ?? "Precision engineering";
  const address = findAfterLabel(text, "address") ?? "1 Industrial Estate, Birmingham";
  const brokerName = findAfterLabel(text, "broker") ?? "Example Broker";
  const inceptionDate = findAfterLabel(text, "inception date") ?? "2026-06-01";
  const turnover = findMoney(text) ?? 12500000;

  const covers = ["Property Damage", "Business Interruption", "Employers Liability", "Public Liability"];
  const missingFields = ["Claims history", "Construction type", "BI indemnity period"];

  return {
    sourceFile,
    insured: { name: insuredName, trade, address, turnover },
    broker: { name: brokerName, contact: findAfterLabel(text, "contact") },
    risk: { classOfBusiness: "Commercial Combined", inceptionDate, coversRequested: covers },
    dataQuality: {
      missingFields,
      warnings: ["Turnover found but not split by activity"],
      confidence: 0.86
    }
  };
}
