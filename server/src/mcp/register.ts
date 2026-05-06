import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { quoteFromProductSubmission } from "../products/registry.js";
import { ProductTypeSchema } from "../schemas/common.schema.js";
import { ProductSubmissionEnvelopeSchema } from "../schemas/productSubmission.schema.js";
import { PropertyOwnersSubmissionEnvelopeSchema } from "../schemas/products/propertyOwners.schema.js";
import { QuoteSchema, SubmissionSchema } from "../schemas/quote.schema.js";
import { parseDocumentInput } from "../services/documentParser.js";
import { classifySubmission, extractSubmissionFromText, getSubmissionIntakeInstructions } from "../services/extractionService.js";
import { extractPropertySubmissionFromText } from "../services/propertyExtractionService.js";
import { getQuote, listQuotes, saveQuote, updateQuote } from "../services/quoteRepository.js";

const quoteRecordResourceUri = "ui://quote-record/index.html";
const quoteRecordHtmlPath = path.resolve(import.meta.dirname, "../../../apps/quote-ui/dist/index.html");
const submissionPlaybookResourceUri = "skill://submission-intake/playbook.md";

const DocumentInputSchema = {
  documentText: z.string().optional().describe("Plain text contents of the uploaded submission document from the Claude prompt"),
  documentBase64: z.string().optional().describe("Base64 encoded PDF document bytes, when the host can pass uploaded file contents directly"),
  mimeType: z.string().optional().describe("Document MIME type, for example application/pdf"),
  fileName: z.string().optional().describe("Original uploaded file name, when available")
};

function markdownCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function formatCurrency(value?: number): string {
  if (value === undefined) return "";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}

function propertyLocationTable(propertySubmission: z.infer<typeof PropertyOwnersSubmissionEnvelopeSchema>): string {
  const rows = propertySubmission.productData.locations.map((location) => [
    location.name,
    location.construction,
    location.yearBuilt,
    location.stories,
    formatCurrency(location.tiv),
    location.occupancy,
    location.notes
  ]);

  return [
    "## Location Schedule",
    "",
    "| Location | Construction | Year | Stories | TIV | Occupancy | Notes |",
    "|---|---|---:|---:|---:|---|---|",
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`)
  ].join("\n");
}

function propertySubmissionMarkdown(propertySubmission: z.infer<typeof PropertyOwnersSubmissionEnvelopeSchema>): string {
  return [
    `# ${propertySubmission.productData.product}`,
    "",
    `Source: ${propertySubmission.sourceFile ?? "Unknown"}`,
    `Insured: ${propertySubmission.productData.insured.name ?? "Missing"}`,
    `Broker: ${propertySubmission.productData.broker.name ?? "Missing"}`,
    "",
    propertyLocationTable(propertySubmission),
    "",
    "## Full Structured Extraction",
    "",
    "```json",
    JSON.stringify(propertySubmission, null, 2),
    "```"
  ].join("\n");
}

function registerResources(server: McpServer) {
  registerAppResource(
    server,
    "Quote Record",
    quoteRecordResourceUri,
    {
      description: "Embedded quote record UI for reviewing extracted submission and quote details"
    },
    async () => {
      const html = await fs.readFile(quoteRecordHtmlPath, "utf-8");
      return {
        contents: [
          {
            uri: quoteRecordResourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html
          }
        ]
      };
    }
  );

  server.registerResource(
    "Submission Intake Playbook",
    submissionPlaybookResourceUri,
    {
      title: "Submission Intake Playbook",
      description: "Markdown skill-style playbook that drives classification and extraction rules",
      mimeType: "text/markdown"
    },
    async () => ({
      contents: [
        {
          uri: submissionPlaybookResourceUri,
          mimeType: "text/markdown",
          text: await getSubmissionIntakeInstructions()
        }
      ]
    })
  );
}

function registerPrompts(server: McpServer) {
  server.prompt(
    "upload_submission",
    "Use after attaching a broker submission file. Classifies the uploaded document and recommends whether to process it.",
    () => ({
      description: "Classify an uploaded broker submission using the submission intake MCP tools.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the submission-intake MCP server to handle the broker submission I uploaded or attached in this conversation.",
              "",
              "If no submission document is attached or available in the prompt, ask me to upload one.",
              "Read the uploaded document text from the Claude prompt, then call classify_document with:",
              "- documentText: the uploaded document text",
              "- fileName: the original uploaded file name, when available",
              "",
              "If the host can pass uploaded PDF bytes instead of extracted text, call classify_document with:",
              "- documentBase64: the base64 encoded PDF bytes",
              "- mimeType: application/pdf",
              "- fileName: the original uploaded PDF file name",
              "",
              "Return the classification, confidence, matched indicators and recommended next action."
            ].join("\n")
          }
        }
      ]
    })
  );

  server.prompt(
    "extract_submission",
    "Extract structured submission data from the uploaded broker submission.",
    () => ({
      description: "Extract quote-ready structured data from an uploaded broker submission.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the submission-intake MCP server to extract structured submission data from the broker submission I uploaded or attached in this conversation.",
              "",
              "If no submission document is attached or available in the prompt, ask me to upload one.",
              "Read the uploaded document text from the Claude prompt, then call extract_submission with:",
              "- documentText: the uploaded document text",
              "- fileName: the original uploaded file name, when available",
              "",
              "If the host can pass uploaded PDF bytes instead of extracted text, call extract_submission with:",
              "- documentBase64: the base64 encoded PDF bytes",
              "- mimeType: application/pdf",
              "- fileName: the original uploaded PDF file name",
              "",
              "Return the extracted insured, broker, risk and data-quality fields. Also call classify_document first if the document has not already been classified in this chat."
            ].join("\n")
          }
        }
      ]
    })
  );

  server.prompt(
    "create_quote",
    "Create a quote from the extracted submission and show the embedded quote record UI.",
    () => ({
      description: "Create a quote shell and render the embedded MCP App quote record UI.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the submission-intake MCP server to create a quote shell from the uploaded broker submission.",
              "",
              "If this is a property owners package submission, call extract_property_submission first and then call create_quote with:",
              "- productSubmission: the extracted property submission envelope",
              "",
              "For generic commercial combined submissions, call extract_submission first and then call create_quote with:",
              "- submission: the extracted generic submission payload",
              "",
              "Return the quote id, status, key extracted details and data-quality warnings. The quote record UI should render inline as an MCP App iframe."
            ].join("\n")
          }
        }
      ]
    })
  );

  server.prompt(
    "get_quote",
    "Browse quotes by product or retrieve a quote by id.",
    () => ({
      description: "List quotes for selection in the embedded quote UI, optionally filtered by product type.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the submission-intake MCP server to browse quote records.",
              "",
              "To list quotes, call get_quote with optional:",
              "- productType: generic_commercial or property_owners",
              "",
              "To retrieve one quote directly, call get_quote with:",
              "- quoteId: the quote id",
              "",
              "When listing quotes, render the embedded quote record UI so I can select a quote and view the details."
            ].join("\n")
          }
        }
      ]
    })
  );
}

function registerTools(server: McpServer) {
  server.tool(
    "classify_document",
    "Classify an insurance document and recommend whether it should be processed as a submission.",
    DocumentInputSchema,
    async (input) => {
      const parsedDocument = await parseDocumentInput(input);
      const classification = await classifySubmission(parsedDocument.text);
      const sourceFile = parsedDocument.sourceFile;
      return {
        content: [{ type: "text", text: JSON.stringify({ sourceFile, parser: parsedDocument.parser, ...classification }, null, 2) }],
        structuredContent: { sourceFile, parser: parsedDocument.parser, ...classification }
      };
    }
  );

  server.tool(
    "extract_submission",
    "Extract structured commercial insurance submission data from a document.",
    DocumentInputSchema,
    async (input) => {
      const parsedDocument = await parseDocumentInput(input);
      const submission = SubmissionSchema.parse(await extractSubmissionFromText(parsedDocument.sourceFile, parsedDocument.text));
      return {
        content: [{ type: "text", text: JSON.stringify(submission, null, 2) }],
        structuredContent: submission
      };
    }
  );

  server.tool(
    "extract_property_submission",
    "Extract property owners package datapoints from a broker submission and validate them against the property schema.",
    DocumentInputSchema,
    async (input) => {
      const parsedDocument = await parseDocumentInput(input);
      const propertySubmission = PropertyOwnersSubmissionEnvelopeSchema.parse(
        await extractPropertySubmissionFromText(parsedDocument.sourceFile, parsedDocument.text)
      );
      return {
        content: [{ type: "text", text: propertySubmissionMarkdown(propertySubmission) }],
        structuredContent: propertySubmission
      };
    }
  );

  registerAppTool(
    server,
    "create_quote",
    {
      title: "Create Quote",
      description: "Create a quote shell from extracted generic or product-specific submission data and render the quote record UI inline.",
      inputSchema: {
        submission: SubmissionSchema.optional().describe("Structured generic submission payload returned from extract_submission"),
        productSubmission: ProductSubmissionEnvelopeSchema.optional().describe("Product-specific submission envelope returned from a product extractor such as extract_property_submission")
      },
      _meta: {
        ui: { resourceUri: quoteRecordResourceUri }
      }
    },
    async ({ submission, productSubmission }) => {
      if (!submission && !productSubmission) {
        throw new Error("Provide either submission or productSubmission.");
      }

      const quote = productSubmission
        ? quoteFromProductSubmission(productSubmission)
        : QuoteSchema.parse({
          quoteId: `Q-POC-${randomUUID().slice(0, 8).toUpperCase()}`,
          status: "Draft",
          createdAt: new Date().toISOString(),
          productType: "generic_commercial",
          insured: submission?.insured,
          broker: submission?.broker,
          risk: submission?.risk,
          dataQuality: submission?.dataQuality
        });
      await saveQuote(quote);
      return {
        content: [
          { type: "text", text: `Quote ${quote.quoteId} created. The quote record UI is rendered inline in Claude.` }
        ],
        structuredContent: quote
      };
    }
  );

  registerAppTool(
    server,
    "get_quote",
    {
      title: "Get Quote",
      description: "Retrieve a quote by id or list quotes for selection, optionally filtered by product type.",
      inputSchema: {
        quoteId: z.string().optional(),
        productType: ProductTypeSchema.optional()
      },
      _meta: {
        ui: { resourceUri: quoteRecordResourceUri }
      }
    },
    async ({ quoteId, productType }) => {
      if (quoteId) {
        const quote = await getQuote(quoteId);
        return {
          content: [{ type: "text", text: JSON.stringify(quote, null, 2) }],
          structuredContent: quote
        };
      }

      const quotes = await listQuotes(productType);
      return {
        content: [{ type: "text", text: JSON.stringify({ productType, quotes }, null, 2) }],
        structuredContent: { productType, quotes }
      };
    }
  );

  server.tool(
    "update_quote_status",
    "Update the quote status.",
    { quoteId: z.string(), status: z.enum(["Draft", "In Review", "Quoted", "Declined"]) },
    async ({ quoteId, status }) => {
      const quote = await updateQuote(quoteId, { status });
      return {
        content: [{ type: "text", text: `Quote ${quoteId} status updated to ${status}.` }],
        structuredContent: quote
      };
    }
  );

  server.tool(
    "update_quote",
    "Update editable quote fields.",
    {
      quoteId: z.string(),
      insured: SubmissionSchema.shape.insured.optional(),
      broker: SubmissionSchema.shape.broker.optional(),
      risk: SubmissionSchema.shape.risk.optional()
    },
    async ({ quoteId, insured, broker, risk }) => {
      const patch = {
        ...(insured ? { insured } : {}),
        ...(broker ? { broker } : {}),
        ...(risk ? { risk } : {})
      };
      const quote = await updateQuote(quoteId, patch);
      return {
        content: [{ type: "text", text: `Quote ${quoteId} updated.` }],
        structuredContent: quote
      };
    }
  );
}

export function registerMcpPrimitives(server: McpServer) {
  registerResources(server);
  registerPrompts(server);
  registerTools(server);
}
