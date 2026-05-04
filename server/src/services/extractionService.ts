import { Submission } from "../schemas/quote.schema.js";
import { getSubmissionPlaybook, SubmissionPlaybook } from "./submissionPlaybook.js";

type ExtractedField<T> = {
  value?: T;
  label?: string;
  evidence?: string;
  confidence: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSubmissionText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textLines(text: string): string[] {
  return normalizeSubmissionText(text).split("\n").map((line) => line.trim()).filter(Boolean);
}

function findMoney(text: string, labels: string[]): ExtractedField<number> {
  const labelPattern = labels.map(escapeRegex).join("|");
  const match = text.match(new RegExp(`\\b(${labelPattern})\\b\\D{0,35}(?:£|GBP)?\\s*([\\d,]+(?:\\.\\d{2})?)`, "i"));
  if (!match) return { confidence: 0 };
  return {
    value: Number(match[2].replace(/,/g, "")),
    label: match[1],
    evidence: match[0].trim(),
    confidence: 0.9
  };
}

function findAfterAnyLabel(text: string, labels: string[]): ExtractedField<string> {
  const lines = textLines(text);
  for (const label of labels) {
    const regex = new RegExp(`^\\s*${escapeRegex(label)}\\s*[:\\-]\\s*(.+)$`, "i");
    for (const line of lines) {
      const value = line.match(regex)?.[1]?.trim();
      if (value) {
        return {
          value,
          label,
          evidence: line,
          confidence: 0.92
        };
      }
    }
  }
  return { confidence: 0 };
}

function labels(playbook: SubmissionPlaybook, field: string): string[] {
  return playbook.labels[field] ?? [field.split(".").at(-1) ?? field];
}

function hasTerm(text: string, value: string): boolean {
  return text.toLowerCase().includes(value.toLowerCase());
}

function detectCovers(text: string, playbook: SubmissionPlaybook): string[] {
  return playbook.coversRequested.filter((cover) => hasTerm(text, cover));
}

function detectMissingFields(text: string, fields: Array<[string, ExtractedField<unknown>]>, playbook: SubmissionPlaybook): string[] {
  const extractionMissing = fields.flatMap(([field, result]) => result.value === undefined ? [field] : []);
  const lowerText = text.toLowerCase();
  const playbookMissing = playbook.missingFields.filter((field) => {
    const fieldText = field.toLowerCase();
    return lowerText.includes(fieldText) || lowerText.includes(fieldText.replace("bi", "business interruption"));
  });
  return [...new Set([...extractionMissing, ...playbookMissing])];
}

function detectWarnings(text: string, turnover: ExtractedField<number>, playbook: SubmissionPlaybook): string[] {
  const warnings = [...playbook.warnings.filter((warning) => {
    if (warning.toLowerCase().includes("turnover")) {
      return turnover.value !== undefined && !text.toLowerCase().includes("split by activity");
    }
    return true;
  })];

  if (text.toLowerCase().includes("not supplied") || text.toLowerCase().includes("pending")) {
    warnings.push("Broker submission contains fields marked as pending or not supplied");
  }

  return [...new Set(warnings)];
}

function confidenceFor(fields: Array<ExtractedField<unknown>>, classificationConfidence: number): number {
  const foundFields = fields.filter((field) => field.value !== undefined);
  const fieldConfidence = foundFields.length / fields.length;
  return Number(((fieldConfidence * 0.75) + (classificationConfidence * 0.25)).toFixed(2));
}

function fieldEvidence(fields: Array<[string, ExtractedField<unknown>]>) {
  return fields.map(([field, result]) => ({
    field,
    label: result.label,
    evidence: result.evidence,
    confidence: result.confidence
  }));
}

export async function getSubmissionIntakeInstructions(): Promise<string> {
  return (await getSubmissionPlaybook()).markdown;
}

export async function classifySubmission(text: string) {
  const playbook = await getSubmissionPlaybook();
  const indicators = playbook.classificationIndicators;
  const normalizedText = normalizeSubmissionText(text);
  const hits = indicators.filter((term) => normalizedText.toLowerCase().includes(term));
  const confidence = Math.min(1, hits.length / 6);
  return {
    documentType: confidence >= 0.45 ? "broker_submission" : "unknown",
    confidence: Number(confidence.toFixed(2)),
    suggestedAction: confidence >= 0.45 ? "process_as_submission" : "manual_review",
    matchedIndicators: hits
  };
}

export async function extractSubmissionFromText(sourceFile: string, text: string): Promise<Submission> {
  const playbook = await getSubmissionPlaybook();
  const normalizedText = normalizeSubmissionText(text);
  const classification = await classifySubmission(normalizedText);
  const insuredName = findAfterAnyLabel(normalizedText, labels(playbook, "insured.name"));
  const trade = findAfterAnyLabel(normalizedText, labels(playbook, "insured.trade"));
  const address = findAfterAnyLabel(normalizedText, labels(playbook, "insured.address"));
  const brokerName = findAfterAnyLabel(normalizedText, labels(playbook, "broker.name"));
  const brokerContact = findAfterAnyLabel(normalizedText, labels(playbook, "broker.contact"));
  const inceptionDate = findAfterAnyLabel(normalizedText, labels(playbook, "risk.inceptionDate"));
  const turnover = findMoney(normalizedText, labels(playbook, "insured.turnover"));
  const detectedCovers = detectCovers(normalizedText, playbook);
  const evidenceFields: Array<[string, ExtractedField<unknown>]> = [
    ["Insured name", insuredName],
    ["Trade", trade],
    ["Address", address],
    ["Turnover", turnover],
    ["Broker name", brokerName],
    ["Broker contact", brokerContact],
    ["Inception date", inceptionDate]
  ];

  return {
    sourceFile,
    insured: {
      name: insuredName.value,
      trade: trade.value,
      address: address.value,
      turnover: turnover.value
    },
    broker: {
      name: brokerName.value,
      contact: brokerContact.value
    },
    risk: {
      classOfBusiness: playbook.defaults["risk.classOfBusiness"],
      inceptionDate: inceptionDate.value,
      coversRequested: detectedCovers.length ? detectedCovers : playbook.coversRequested,
    },
    dataQuality: {
      missingFields: detectMissingFields(normalizedText, evidenceFields, playbook),
      warnings: detectWarnings(normalizedText, turnover, playbook),
      confidence: confidenceFor(evidenceFields.map(([, field]) => field), classification.confidence),
      evidence: fieldEvidence(evidenceFields)
    }
  };
}
