import { Submission } from "../schemas/quote.schema.js";
import { getSubmissionPlaybook, SubmissionPlaybook } from "./submissionPlaybook.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMoney(text: string, labels: string[]): number | undefined {
  const labelPattern = labels.map(escapeRegex).join("|");
  const match = text.match(new RegExp(`(?:${labelPattern})\\D{0,20}£?([\\d,]+)`, "i"));
  if (!match) return undefined;
  return Number(match[1].replace(/,/g, ""));
}

function findAfterAnyLabel(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const regex = new RegExp(`${escapeRegex(label)}\\s*[:\\-]\\s*(.+)`, "i");
    const value = text.match(regex)?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
}

function labels(playbook: SubmissionPlaybook, field: string): string[] {
  return playbook.labels[field] ?? [field.split(".").at(-1) ?? field];
}

export async function getSubmissionIntakeInstructions(): Promise<string> {
  return (await getSubmissionPlaybook()).markdown;
}

export async function classifySubmission(text: string) {
  const playbook = await getSubmissionPlaybook();
  const indicators = playbook.classificationIndicators;
  const hits = indicators.filter((term) => text.toLowerCase().includes(term));
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
  const insuredName = findAfterAnyLabel(text, labels(playbook, "insured.name")) ?? playbook.defaults["insured.name"];
  const trade = findAfterAnyLabel(text, labels(playbook, "insured.trade")) ?? playbook.defaults["insured.trade"];
  const address = findAfterAnyLabel(text, labels(playbook, "insured.address")) ?? playbook.defaults["insured.address"];
  const brokerName = findAfterAnyLabel(text, labels(playbook, "broker.name")) ?? playbook.defaults["broker.name"];
  const inceptionDate = findAfterAnyLabel(text, labels(playbook, "risk.inceptionDate")) ?? playbook.defaults["risk.inceptionDate"];
  const turnover = findMoney(text, labels(playbook, "insured.turnover")) ?? Number(playbook.defaults["insured.turnover"]);

  return {
    sourceFile,
    insured: { name: insuredName, trade, address, turnover },
    broker: { name: brokerName, contact: findAfterAnyLabel(text, labels(playbook, "broker.contact")) },
    risk: {
      classOfBusiness: playbook.defaults["risk.classOfBusiness"],
      inceptionDate,
      coversRequested: playbook.coversRequested,
    },
    dataQuality: {
      missingFields: playbook.missingFields,
      warnings: playbook.warnings,
      confidence: Number(playbook.defaults["dataQuality.confidence"])
    }
  };
}
