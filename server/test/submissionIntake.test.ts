import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { classifySubmission, extractSubmissionFromText } from "../src/services/extractionService.js";
import { parseDocumentInput } from "../src/services/documentParser.js";
import { extractPropertySubmissionFromText } from "../src/services/propertyExtractionService.js";
import { getQuote, listQuotes, saveQuote, updateQuote } from "../src/services/quoteRepository.js";
import { QuoteSchema, SubmissionSchema } from "../src/schemas/quote.schema.js";
import { PropertyOwnersSubmissionEnvelopeSchema } from "../src/schemas/products/propertyOwners.schema.js";

const samplePath = path.resolve(process.cwd(), "../samples/sample-submission.txt");
const propertyPdfPath = "/Users/jatinpatel/Downloads/commercial_insurance_submission_test_pack (1)/pdf/SUB-001_property_owners_package___mixed_use_portfolio.pdf";

async function readSampleSubmission(): Promise<string> {
  return fs.readFile(samplePath, "utf-8");
}

function pdfBase64WithText(lines: string[]): string {
  const escapedLines = lines.map((line) => line.replace(/[()\\]/g, "\\$&"));
  const content = [
    "BT /F1 12 Tf 72 720 Td",
    ...escapedLines.flatMap((line, index) => [
      index === 0 ? "" : "0 -16 Td",
      `(${line}) Tj`
    ]),
    "ET"
  ].filter(Boolean).join(" ");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf).toString("base64");
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

  assert.equal(parsedSubmission.sourceFile, "sample-submission.txt");
  assert.deepEqual(parsedSubmission.insured, {
    name: "ABC Manufacturing Ltd",
    trade: "Precision engineering",
    address: "1 Industrial Estate, Birmingham",
    turnover: 12500000
  });
  assert.deepEqual(parsedSubmission.broker, {
    name: "Example Broker",
    contact: "jane.smith@examplebroker.co.uk"
  });
  assert.deepEqual(parsedSubmission.risk, {
    classOfBusiness: "Commercial Combined",
    inceptionDate: "2026-06-01",
    coversRequested: [
      "Property Damage",
      "Business Interruption",
      "Employers Liability",
      "Public Liability"
    ]
  });
  assert.deepEqual(parsedSubmission.dataQuality.missingFields, ["Claims history", "Construction type", "BI indemnity period"]);
  assert.deepEqual(parsedSubmission.dataQuality.warnings, [
    "Turnover found but not split by activity",
    "Broker submission contains fields marked as pending or not supplied"
  ]);
  assert.equal(parsedSubmission.dataQuality.confidence, 1);
  assert.equal(parsedSubmission.dataQuality.evidence?.some((item) => item.field === "Insured name" && item.evidence === "Insured: ABC Manufacturing Ltd"), true);
});

test("flags extracted fields as missing instead of inventing defaults", async () => {
  const documentText = [
    "Broker submission for commercial combined terms.",
    "The insured requests property damage, business interruption, employers liability and public liability.",
    "Claims history is pending. Premium indication requested."
  ].join("\n");

  const submission = SubmissionSchema.parse(await extractSubmissionFromText("minimal-submission.txt", documentText));

  assert.equal(submission.sourceFile, "minimal-submission.txt");
  assert.deepEqual(submission.insured, {
    name: undefined,
    trade: undefined,
    address: undefined,
    turnover: undefined
  });
  assert.equal(submission.broker?.name, undefined);
  assert.equal(submission.risk.inceptionDate, undefined);
  assert.deepEqual(submission.dataQuality.missingFields, [
    "Insured name",
    "Trade",
    "Address",
    "Turnover",
    "Broker name",
    "Broker contact",
    "Inception date",
    "Claims history"
  ]);
});

test("extracts text from a base64 encoded PDF submission", async () => {
  const documentBase64 = pdfBase64WithText([
    "Broker: Example Broker",
    "Contact: jane.smith@examplebroker.co.uk",
    "Insured: ABC Manufacturing Ltd",
    "Trade: Precision engineering",
    "Address: 1 Industrial Estate, Birmingham",
    "Turnover: £12,500,000",
    "Inception Date: 2026-06-01",
    "Requested covers: Property Damage, Business Interruption, Employers Liability, Public Liability"
  ]);

  const parsedDocument = await parseDocumentInput({
    documentBase64,
    fileName: "sample-submission.pdf",
    mimeType: "application/pdf"
  });

  const submission = SubmissionSchema.parse(await extractSubmissionFromText(parsedDocument.sourceFile, parsedDocument.text));

  assert.equal(parsedDocument.parser, "pdf");
  assert.equal(submission.sourceFile, "sample-submission.pdf");
  assert.equal(submission.insured.name, "ABC Manufacturing Ltd");
  assert.equal(submission.insured.turnover, 12500000);
  assert.deepEqual(submission.risk.coversRequested, [
    "Property Damage",
    "Business Interruption",
    "Employers Liability",
    "Public Liability"
  ]);
});

test("extracts property owners package datapoints from SUB-001 PDF", async (t) => {
  try {
    await fs.access(propertyPdfPath);
  } catch {
    t.skip("SUB-001 property PDF fixture is not available on this machine.");
    return;
  }

  const parsedDocument = await parseDocumentInput({
    documentBase64: await fs.readFile(propertyPdfPath, "base64"),
    fileName: path.basename(propertyPdfPath),
    mimeType: "application/pdf"
  });
  const submission = PropertyOwnersSubmissionEnvelopeSchema.parse(
    await extractPropertySubmissionFromText(parsedDocument.sourceFile, parsedDocument.text)
  );
  const property = submission.productData;

  assert.equal(submission.productType, "property_owners");
  assert.equal(property.product, "Property Owners Package");
  assert.equal(property.insured.name, "Marwick Row Estates Ltd");
  assert.equal(property.insured.industryCode, "531120 - Lessors of Nonresidential Buildings");
  assert.equal(property.insured.revenueOrTurnover, 8700000);
  assert.equal(property.insured.employees, 24);
  assert.equal(property.broker.name, "Aster Risk Partners");
  assert.equal(property.broker.contact, "Marina Patel");
  assert.equal(property.broker.email, "marina.patel@example-broker.test");
  assert.equal(property.broker.submissionReference, "SUB-001");
  assert.equal(property.coverage.buildingsAndLandlordContents, 96450000);
  assert.equal(property.coverage.lossOfRentMonths, 36);
  assert.equal(property.coverage.propertyOwnersLiability, 10000000);
  assert.equal(property.coverage.terrorismIncluded, true);
  assert.equal(property.coverage.engineeringInspectionAndBreakdownRequested, true);
  assert.equal(property.locations.length, 5);
  assert.equal(property.locations[0].name, "17-25 Marwick Row, London SE1");
  assert.equal(property.locations[0].tiv, 28400000);
  assert.equal(property.locations[0].occupancy, "Retail ground floor; apartments above");
  assert.equal(property.locations[0].notes, "18% unoccupied");
  assert.equal(property.locations[1].occupancy, "restaurant tenant with deep-fat fryers");
  assert.equal(property.locations[1].notes, "Grade II facade");
  assert.equal(property.locations[2].occupancy, "Student accommodation");
  assert.equal(property.locations[2].notes, "cladding remediation completed 2024");
  assert.equal(property.lossHistory.length, 3);
  assert.equal(property.lossHistory[0].type, "Escape of water");
  assert.equal(property.lossHistory[0].paid, 186400);
  assert.equal(property.attachments.length, 5);
  assert.equal(property.underwriting.escapeOfWaterDeductibleCap, 25000);
  assert.deepEqual(submission.dataQuality.missingFields, []);
  assert.equal(submission.dataQuality.warnings.includes("Unresolved EWS1 wording referenced in lender correspondence"), true);
});

test("stores property location schedule on quote records", async (t) => {
  try {
    await fs.access(propertyPdfPath);
  } catch {
    t.skip("SUB-001 property PDF fixture is not available on this machine.");
    return;
  }

  const parsedDocument = await parseDocumentInput({
    documentBase64: await fs.readFile(propertyPdfPath, "base64"),
    fileName: path.basename(propertyPdfPath),
    mimeType: "application/pdf"
  });
  const productSubmission = PropertyOwnersSubmissionEnvelopeSchema.parse(
    await extractPropertySubmissionFromText(parsedDocument.sourceFile, parsedDocument.text)
  );
  const quote = QuoteSchema.parse({
    quoteId: `Q-TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "Draft",
    createdAt: new Date("2026-05-04T00:00:00.000Z").toISOString(),
    insured: {
      name: productSubmission.common.insured.name,
      trade: productSubmission.common.insured.trade,
      turnover: productSubmission.common.insured.turnover
    },
    broker: productSubmission.common.broker,
    risk: productSubmission.common.risk,
    productType: productSubmission.productType,
    dataQuality: productSubmission.dataQuality,
    productSubmission
  });

  const propertyData = PropertyOwnersSubmissionEnvelopeSchema.parse(quote.productSubmission).productData;
  assert.equal(quote.productType, "property_owners");
  assert.equal(propertyData.locations.length, 5);
  assert.equal(propertyData.locations[3].name, "Northgate Parade, Leeds LS2");
  assert.equal(propertyData.locations[3].notes, "ATM embedded");
  assert.equal(propertyData.coverage.buildingsAndLandlordContents, 96450000);
});

test("produces quote-shaped output from an extracted submission", async () => {
  const documentText = await readSampleSubmission();
  const submission = SubmissionSchema.parse(await extractSubmissionFromText("sample-submission.txt", documentText));

  const quote = QuoteSchema.parse({
    quoteId: `Q-TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "Draft",
    createdAt: new Date("2026-05-04T00:00:00.000Z").toISOString(),
    productType: "generic_commercial",
    insured: submission.insured,
    broker: submission.broker,
    risk: submission.risk,
    dataQuality: submission.dataQuality
  });

  assert.match(quote.quoteId, /^Q-TEST-[0-9A-F]{8}$/);
  assert.equal(quote.status, "Draft");
  assert.equal(quote.insured.name, "ABC Manufacturing Ltd");
  assert.equal(quote.risk.classOfBusiness, "Commercial Combined");
  assert.deepEqual(quote.dataQuality.warnings, [
    "Turnover found but not split by activity",
    "Broker submission contains fields marked as pending or not supplied"
  ]);
});

test("lists quote summaries and filters them by product type", async () => {
  const originalQuoteDataDir = process.env.QUOTE_DATA_DIR;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "submission-intake-quote-list-"));

  try {
    process.env.QUOTE_DATA_DIR = tempRoot;

    const genericQuote = QuoteSchema.parse({
      quoteId: "Q-TEST-GENERIC",
      status: "Draft",
      createdAt: new Date("2026-05-03T12:00:00.000Z").toISOString(),
      productType: "generic_commercial",
      insured: { name: "ABC Manufacturing Ltd" },
      broker: { name: "Example Broker" },
      risk: {
        classOfBusiness: "Commercial Combined",
        coversRequested: ["Property Damage"]
      },
      dataQuality: {
        missingFields: [],
        warnings: [],
        confidence: 0.9
      }
    });
    const propertySubmission = PropertyOwnersSubmissionEnvelopeSchema.parse({
      productType: "property_owners",
      common: {
        insured: { name: "Marwick Row Estates Ltd", trade: "Property Owners", turnover: 8700000 },
        broker: { name: "Aster Risk Partners", contact: "Marina Patel" },
        risk: {
          classOfBusiness: "Property Owners Package",
          inceptionDate: "2026-06-01",
          coversRequested: ["Property Damage", "Property Owners Liability"]
        }
      },
      productData: {
        product: "Property Owners Package",
        insured: { name: "Marwick Row Estates Ltd", revenueOrTurnover: 8700000 },
        broker: { name: "Aster Risk Partners", contact: "Marina Patel" },
        coverage: {
          buildingsAndLandlordContents: 96450000,
          propertyOwnersLiability: 10000000
        },
        locations: [{ name: "17-25 Marwick Row, London SE1", tiv: 28400000 }],
        lossHistory: [],
        attachments: [],
        underwriting: {}
      },
      dataQuality: {
        missingFields: [],
        warnings: [],
        confidence: 0.94
      }
    });
    const propertyQuote = QuoteSchema.parse({
      quoteId: "Q-TEST-PROPERTY",
      status: "In Review",
      createdAt: new Date("2026-05-04T12:00:00.000Z").toISOString(),
      productType: "property_owners",
      insured: propertySubmission.common.insured,
      broker: propertySubmission.common.broker,
      risk: propertySubmission.common.risk,
      dataQuality: propertySubmission.dataQuality,
      productSubmission: propertySubmission
    });

    await saveQuote(genericQuote);
    await saveQuote(propertyQuote);

    const allQuotes = await listQuotes();
    const propertyQuotes = await listQuotes("property_owners");

    assert.deepEqual(allQuotes.map((quote) => quote.quoteId), ["Q-TEST-PROPERTY", "Q-TEST-GENERIC"]);
    assert.deepEqual(propertyQuotes, [{
      quoteId: "Q-TEST-PROPERTY",
      status: "In Review",
      createdAt: "2026-05-04T12:00:00.000Z",
      productType: "property_owners",
      insuredName: "Marwick Row Estates Ltd",
      brokerName: "Aster Risk Partners",
      classOfBusiness: "Property Owners Package"
    }]);
  } finally {
    if (originalQuoteDataDir === undefined) {
      delete process.env.QUOTE_DATA_DIR;
    } else {
      process.env.QUOTE_DATA_DIR = originalQuoteDataDir;
    }
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
});

test("allocates an underwriter when a quote is sent to review", async () => {
  const originalQuoteDataDir = process.env.QUOTE_DATA_DIR;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "submission-intake-underwriter-"));

  try {
    process.env.QUOTE_DATA_DIR = tempRoot;

    const quote = QuoteSchema.parse({
      quoteId: "Q-TEST-ALLOCATE",
      status: "Draft",
      createdAt: new Date("2026-05-04T00:00:00.000Z").toISOString(),
      productType: "property_owners",
      insured: { name: "Marwick Row Estates Ltd" },
      broker: { name: "Aster Risk Partners" },
      risk: {
        classOfBusiness: "Property Owners Package",
        coversRequested: ["Property Damage", "Property Owners Liability"]
      },
      dataQuality: {
        missingFields: [],
        warnings: [],
        confidence: 0.94
      },
      productSubmission: PropertyOwnersSubmissionEnvelopeSchema.parse({
        productType: "property_owners",
        common: {
          insured: { name: "Marwick Row Estates Ltd", trade: "Property Owners" },
          broker: { name: "Aster Risk Partners" },
          risk: {
            classOfBusiness: "Property Owners Package",
            coversRequested: ["Property Damage", "Property Owners Liability"]
          }
        },
        productData: {
          product: "Property Owners Package",
          insured: { name: "Marwick Row Estates Ltd" },
          broker: { name: "Aster Risk Partners" },
          coverage: {},
          locations: [{ name: "17-25 Marwick Row, London SE1" }],
          lossHistory: [],
          attachments: [],
          underwriting: {}
        },
        dataQuality: {
          missingFields: [],
          warnings: [],
          confidence: 0.94
        }
      })
    });

    await saveQuote(quote);

    const reviewedQuote = await updateQuote(quote.quoteId, { status: "In Review" });
    const summaries = await listQuotes("property_owners");

    assert.equal(reviewedQuote.status, "In Review");
    assert.equal(reviewedQuote.underwriter?.name, "Maya Desai");
    assert.equal(reviewedQuote.underwriter?.team, "Property Owners");
    assert.match(reviewedQuote.underwriter?.allocatedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(summaries[0].underwriterName, "Maya Desai");
  } finally {
    if (originalQuoteDataDir === undefined) {
      delete process.env.QUOTE_DATA_DIR;
    } else {
      process.env.QUOTE_DATA_DIR = originalQuoteDataDir;
    }
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
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
      productType: "generic_commercial",
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
