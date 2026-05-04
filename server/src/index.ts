import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { getQuote, saveQuote, updateQuote } from "./services/quoteRepository.js";
import { classifySubmission, extractSubmissionFromText, getSubmissionIntakeInstructions } from "./services/extractionService.js";
import { QuoteSchema, SubmissionSchema } from "./schemas/quote.schema.js";

const API_PORT = Number(process.env.API_PORT ?? 8787);

const api = express();
api.use(cors());
api.use(express.json());

api.get("/api/health", (_req, res) => res.json({ ok: true }));

api.get("/api/quotes/:quoteId", async (req, res) => {
  try {
    res.json(await getQuote(req.params.quoteId));
  } catch {
    res.status(404).json({ error: "Quote not found" });
  }
});

api.patch("/api/quotes/:quoteId", async (req, res) => {
  try {
    res.json(await updateQuote(req.params.quoteId, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid update" });
  }
});

api.listen(API_PORT, () => {
  console.error(`Quote API listening on http://localhost:${API_PORT}`);
});

const server = new McpServer({ name: "submission-intake", version: "0.1.0" });
const quoteRecordResourceUri = "ui://quote-record/index.html";
const quoteRecordHtmlPath = path.resolve(import.meta.dirname, "../../apps/quote-ui/dist/index.html");
const submissionPlaybookResourceUri = "skill://submission-intake/playbook.md";

const DocumentInputSchema = {
  documentText: z.string().min(1).describe("Plain text contents of the uploaded submission document from the Claude prompt"),
  fileName: z.string().optional().describe("Original uploaded file name, when available")
};

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
            "If structured submission data has not already been extracted in this chat, call extract_submission first using the uploaded document text and file name.",
            "Then call create_quote with the extracted submission payload.",
            "",
            "Return the quote id, status, key extracted details and data-quality warnings. The quote record UI should render inline as an MCP App iframe."
          ].join("\n")
        }
      }
    ]
  })
);

server.tool(
  "classify_document",
  "Classify an insurance document and recommend whether it should be processed as a submission.",
  DocumentInputSchema,
  async ({ documentText, fileName }) => {
    const classification = await classifySubmission(documentText);
    const sourceFile = fileName ?? "Claude prompt upload";
    return {
      content: [{ type: "text", text: JSON.stringify({ sourceFile, ...classification }, null, 2) }],
      structuredContent: { sourceFile, ...classification }
    };
  }
);

server.tool(
  "extract_submission",
  "Extract structured commercial insurance submission data from a document.",
  DocumentInputSchema,
  async ({ documentText, fileName }) => {
    const submission = SubmissionSchema.parse(await extractSubmissionFromText(fileName ?? "Claude prompt upload", documentText));
    return {
      content: [{ type: "text", text: JSON.stringify(submission, null, 2) }],
      structuredContent: submission
    };
  }
);

registerAppTool(
  server,
  "create_quote",
  {
    title: "Create Quote",
    description: "Create a quote shell from extracted submission data and render the quote record UI inline.",
    inputSchema: {
      submission: SubmissionSchema.describe("Structured submission payload returned from extract_submission")
    },
    _meta: {
      ui: { resourceUri: quoteRecordResourceUri }
    }
  },
  async ({ submission }) => {
    const quoteId = `Q-POC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const quote = QuoteSchema.parse({
      quoteId,
      status: "Draft",
      createdAt: new Date().toISOString(),
      insured: submission.insured,
      broker: submission.broker,
      risk: submission.risk,
      dataQuality: submission.dataQuality
    });
    await saveQuote(quote);
    return {
      content: [
        { type: "text", text: `Quote ${quoteId} created. The quote record UI is rendered inline in Claude.` }
      ],
      structuredContent: quote
    };
  }
);

server.tool(
  "get_quote",
  "Retrieve a quote record by quote id.",
  { quoteId: z.string() },
  async ({ quoteId }) => {
    const quote = await getQuote(quoteId);
    return {
      content: [{ type: "text", text: JSON.stringify(quote, null, 2) }],
      structuredContent: quote
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

const transport = new StdioServerTransport();
await server.connect(transport);
