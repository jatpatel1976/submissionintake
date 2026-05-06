import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getQuote, listQuotes, updateQuote } from "./services/quoteRepository.js";
import { ProductTypeSchema } from "./schemas/common.schema.js";
import { registerMcpPrimitives } from "./mcp/register.js";

const API_PORT = Number(process.env.API_PORT ?? 8787);

const api = express();
api.use(cors());
api.use(express.json());

api.get("/api/health", (_req, res) => res.json({ ok: true }));

api.get("/api/quotes", async (req, res) => {
  try {
    const productType = typeof req.query.productType === "string"
      ? ProductTypeSchema.parse(req.query.productType)
      : undefined;
    res.json({ quotes: await listQuotes(productType), productType });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid quote list request" });
  }
});

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
registerMcpPrimitives(server);

const transport = new StdioServerTransport();
await server.connect(transport);
