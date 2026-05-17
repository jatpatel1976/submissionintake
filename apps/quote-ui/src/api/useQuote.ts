import React from "react";
import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import type { Quote, QuoteSummary, ToolResult, ViewMode } from "../types";

const API_BASE = "http://localhost:8787";
const isEmbeddedMcpApp = window.parent !== window;

function quoteResultFromToolResult(result: ToolResult): { quote: Quote; view?: ViewMode } | null {
  const structuredContent = result.structuredContent as Quote | { quote?: Quote; view?: ViewMode } | undefined;
  if (!structuredContent || typeof structuredContent !== "object") return null;
  if ("quoteId" in structuredContent) return { quote: structuredContent };
  if ("quote" in structuredContent && structuredContent.quote?.quoteId) {
    return { quote: structuredContent.quote, view: structuredContent.view };
  }
  return null;
}

function quoteListFromToolResult(result: ToolResult): QuoteSummary[] | null {
  const structuredContent = result.structuredContent as { quotes?: QuoteSummary[] } | undefined;
  if (!structuredContent?.quotes) return null;
  return structuredContent.quotes;
}

export function useQuote() {
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteList, setQuoteList] = React.useState<QuoteSummary[] | null>(null);
  const [view, setView] = React.useState<ViewMode>("record");
  const [error, setError] = React.useState<string | null>(null);
  const [isConnecting, setIsConnecting] = React.useState(isEmbeddedMcpApp);
  const mcpAppRef = React.useRef<McpApp | null>(null);

  React.useEffect(() => {
    if (isEmbeddedMcpApp) {
      const app = new McpApp({ name: "Quote Record", version: "0.1.0" });
      mcpAppRef.current = app;

      app.ontoolresult = (result) => {
        const nextQuoteList = quoteListFromToolResult(result);
        if (nextQuoteList) {
          setQuoteList(nextQuoteList);
          setQuote(null);
          setError(null);
          return;
        }

        const nextQuoteResult = quoteResultFromToolResult(result);
        if (nextQuoteResult) {
          setQuote(nextQuoteResult.quote);
          setQuoteList(null);
          setView(nextQuoteResult.view ?? "record");
          setError(null);
        }
      };

      app.connect()
        .then(() => setIsConnecting(false))
        .catch((err) => {
          setIsConnecting(false);
          setError(err instanceof Error ? err.message : "Unable to connect to Claude.");
        });

      return () => {
        mcpAppRef.current = null;
        void app.close();
      };
    }

    const params = new URLSearchParams(window.location.search);
    const quoteId = params.get("quoteId");
    const requestedView = params.get("view") === "data_points"
      ? "data_points"
      : params.get("view") === "graph"
        ? "graph"
        : "record";
    setView(requestedView);
    if (!quoteId) {
      fetch(`${API_BASE}/api/quotes`)
        .then((res) => {
          if (!res.ok) throw new Error("Unable to load quotes");
          return res.json();
        })
        .then((data) => setQuoteList(data.quotes))
        .catch((err) => setError(err.message));
      return;
    }
    fetch(`${API_BASE}/api/quotes/${quoteId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Quote not found");
        return res.json();
      })
      .then(setQuote)
      .catch((err) => setError(err.message));
  }, []);

  async function loadQuote(quoteId: string, preferredView: ViewMode = "record") {
    if (mcpAppRef.current) {
      const result = await mcpAppRef.current.callServerTool({
        name: "get_quote",
        arguments: { quoteId, view: preferredView }
      });
      const nextQuoteResult = quoteResultFromToolResult(result);
      if (nextQuoteResult) {
        setQuote(nextQuoteResult.quote);
        setQuoteList(null);
        setView(nextQuoteResult.view ?? preferredView);
      }
      return;
    }

    const res = await fetch(`${API_BASE}/api/quotes/${quoteId}`);
    if (!res.ok) throw new Error("Quote not found");
    setQuote(await res.json());
    setQuoteList(null);
    setView(preferredView);
  }

  async function loadQuoteList(productType?: Quote["productType"]) {
    if (mcpAppRef.current) {
      const result = await mcpAppRef.current.callServerTool({
        name: "get_quote",
        arguments: { productType }
      });
      const nextQuoteList = quoteListFromToolResult(result);
      if (nextQuoteList) {
        setQuoteList(nextQuoteList);
        setQuote(null);
      }
      return;
    }

    const params = productType ? `?productType=${encodeURIComponent(productType)}` : "";
    const res = await fetch(`${API_BASE}/api/quotes${params}`);
    if (!res.ok) throw new Error("Unable to load quotes");
    const data = await res.json();
    setQuoteList(data.quotes);
    setQuote(null);
  }

  async function updateStatus(status: Quote["status"]) {
    if (!quote) return;

    if (mcpAppRef.current) {
      const result = await mcpAppRef.current.callServerTool({
        name: "update_quote_status",
        arguments: { quoteId: quote.quoteId, status }
      });
      const nextQuoteResult = quoteResultFromToolResult(result);
      if (nextQuoteResult) setQuote(nextQuoteResult.quote);
      return;
    }

    const res = await fetch(`${API_BASE}/api/quotes/${quote.quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    setQuote(await res.json());
  }

  async function updateQuote(patch: Pick<Partial<Quote>, "insured" | "broker" | "risk">) {
    if (!quote) return;

    if (mcpAppRef.current) {
      const result = await mcpAppRef.current.callServerTool({
        name: "update_quote",
        arguments: { quoteId: quote.quoteId, ...patch }
      });
      const nextQuoteResult = quoteResultFromToolResult(result);
      if (nextQuoteResult) setQuote(nextQuoteResult.quote);
      return;
    }

    const res = await fetch(`${API_BASE}/api/quotes/${quote.quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    setQuote(await res.json());
  }

  return { quote, quoteList, view, setView, error, isConnecting, loadQuote, loadQuoteList, updateStatus, updateQuote };
}
