import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { classifySubmission, extractSubmissionFromText } from "../src/services/extractionService.js";
import { getQuote, saveQuote } from "../src/services/quoteRepository.js";
import { QuoteSchema, SubmissionSchema } from "../src/schemas/quote.schema.js";

const samplePath = path.resolve(process.cwd(), "../samples/sample-submission.txt");

async function readSampleSubmission(): Promise<string> {
  return fs.readFile(samplePath, "utf-8");
}

test("classifies the sample submission as a broker submission", async () => {
  const documentText = await readSampleSubmission();

  const classification = await classifySubmission(documentText);

  assert.equal(classification.documentType, "broker_submission");
  assert.equal(classification.suggestedAction, "process_as_submission");
  assert.equal(classification.confidence, 1);
  assert.deepEqual(
    classification.matchedIndicators,
    [
      "insured",
      "broker",
      "claims",
      "turnover",
      "inception",
      "public liability",
      "property damage",
      "employers liability",
      "business interruption"
    ],
  );
});

test("extracts structured submission output from the sample document", async () => {
  const documentText = await readSampleSubmission();

  const submission = await extractSubmissionFromText("sample-submission.txt", documentText);
  const parsedSubmission = SubmissionSchema.parse(submission);

  assert.deepEqual(parsedSubmission, {
    sourceFile: "sample-submission.txt",
    insured: {
      name: "ABC Manufacturing Ltd",
      trade: "Precision engineering",
      address: "1 Industrial Estate, Birmingham",
      turnover: 12500000
    },
    broker: {
      name: "Example Broker",
      contact: "jane.smith@examplebroker.co.uk"
    },
    risk: {
      classOfBusiness: "Commercial Combined",
      inceptionDate: "2026-06-01",
      coversRequested: [
        "Property Damage",
        "Business Interruption",
        "Employers Liability",
        "Public Liability"
      ]
    },
    dataQuality: {
      missingFields: ["Claims history", "Construction type", "BI indemnity period"],
      warnings: ["Turnover found but not split by activity"],
      confidence: 0.86
    }
  });
});

test("uses playbook defaults when optional submission labels are missing", async () => {
  const documentText = [
    "Broker submission for commercial combined terms.",
    "The insured requests property damage, business interruption, employers liability and public liability.",
    "Claims history is pending. Premium indication requested."
  ].join("\n");

  const submission = SubmissionSchema.parse(await extractSubmissionFromText("minimal-submission.txt", documentText));

  assert.equal(submission.sourceFile, "minimal-submission.txt");
  assert.deepEqual(submission.insured, {
    name: "ABC Manufacturing Ltd",
    trade: "Precision engineering",
    address: "1 Industrial Estate, Birmingham",
    turnover: 12500000
  });
  assert.equal(submission.broker?.name, "Example Broker");
  assert.equal(submission.risk.inceptionDate, "2026-06-01");
});

test("produces quote-shaped output from an extracted submission", async () => {
  const documentText = await readSampleSubmission();
  const submission = SubmissionSchema.parse(await extractSubmissionFromText("sample-submission.txt", documentText));

  const quote = QuoteSchema.parse({
    quoteId: `Q-TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "Draft",
    createdAt: new Date("2026-05-04T00:00:00.000Z").toISOString(),
    insured: submission.insured,
    broker: submission.broker,
    risk: submission.risk,
    dataQuality: submission.dataQuality
  });

  assert.match(quote.quoteId, /^Q-TEST-[0-9A-F]{8}$/);
  assert.equal(quote.status, "Draft");
  assert.equal(quote.insured.name, "ABC Manufacturing Ltd");
  assert.equal(quote.risk.classOfBusiness, "Commercial Combined");
  assert.deepEqual(quote.dataQuality.warnings, ["Turnover found but not split by activity"]);
});

test("persists quotes when the server is launched from another working directory", async () => {
  const originalCwd = process.cwd();
  const originalQuoteDataDir = process.env.QUOTE_DATA_DIR;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "submission-intake-quotes-"));
  const launchDir = path.join(tempRoot, "launch-dir");
  const quoteDataDir = path.join(tempRoot, "quote-data");
  await fs.mkdir(launchDir);

  try {
    process.env.QUOTE_DATA_DIR = quoteDataDir;
    process.chdir(launchDir);

    const quote = QuoteSchema.parse({
      quoteId: `Q-TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: "Draft",
      createdAt: new Date("2026-05-04T00:00:00.000Z").toISOString(),
      insured: {
        name: "ABC Manufacturing Ltd",
        trade: "Precision engineering",
        address: "1 Industrial Estate, Birmingham",
        turnover: 12500000
      },
      broker: {
        name: "Example Broker",
        contact: "jane.smith@examplebroker.co.uk"
      },
      risk: {
        classOfBusiness: "Commercial Combined",
        inceptionDate: "2026-06-01",
        coversRequested: ["Property Damage", "Business Interruption"]
      },
      dataQuality: {
        missingFields: [],
        warnings: [],
        confidence: 0.86
      }
    });

    await saveQuote(quote);

    assert.deepEqual(await getQuote(quote.quoteId), quote);
  } finally {
    process.chdir(originalCwd);
    if (originalQuoteDataDir === undefined) {
      delete process.env.QUOTE_DATA_DIR;
    } else {
      process.env.QUOTE_DATA_DIR = originalQuoteDataDir;
    }
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
});
