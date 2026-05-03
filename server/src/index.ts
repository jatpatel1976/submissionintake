import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getQuote, saveQuote, updateQuote } from "./services/quoteRepository.js";
import { extractText } from "./services/documentParser.js";
import { classifySubmission, extractSubmissionFromText } from "./services/extractionService.js";
import { QuoteSchema, SubmissionSchema } from "./schemas/quote.schema.js";

const UI_BASE_URL = process.env.UI_BASE_URL ?? "http://localhost:5173";
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

server.tool(
  "classify_document",
  "Classify an insurance document and recommend whether it should be processed as a submission.",
  { filePath: z.string().describe("Absolute path to a local .txt or .md sample document") },
  async ({ filePath }) => {
    const text = await extractText(filePath);
    const classification = classifySubmission(text);
    return {
      content: [{ type: "text", text: JSON.stringify({ filePath, ...classification }, null, 2) }],
      structuredContent: { filePath, ...classification }
    };
  }
);

server.tool(
  "extract_submission",
  "Extract structured commercial insurance submission data from a document.",
  { filePath: z.string().describe("Absolute path to a local .txt or .md sample document") },
  async ({ filePath }) => {
    const text = await extractText(filePath);
    const submission = SubmissionSchema.parse(extractSubmissionFromText(filePath, text));
    return {
      content: [{ type: "text", text: JSON.stringify(submission, null, 2) }],
      structuredContent: submission
    };
  }
);

server.tool(
  "create_quote",
  "Create a quote shell from extracted submission data and return an app link for the quote record UI.",
  {
    submission: SubmissionSchema.describe("Structured submission payload returned from extract_submission")
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
    const appUrl = `${UI_BASE_URL}?quoteId=${encodeURIComponent(quoteId)}`;
    return {
      content: [
        { type: "text", text: `Quote ${quoteId} created. Open the quote record UI: ${appUrl}` }
      ],
      structuredContent: { quoteId, status: quote.status, appUrl }
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

const transport = new StdioServerTransport();
await server.connect(transport);
