import React from "react";
import ReactDOM from "react-dom/client";
import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, FileText, Pencil, Save, Send, ShieldCheck, X } from "lucide-react";
import "./styles.css";

type Quote = {
  quoteId: string;
  status: "Draft" | "In Review" | "Quoted" | "Declined";
  createdAt: string;
  productType: "generic_commercial" | "property_owners";
  underwriter?: { name: string; team: string; email: string; allocatedAt: string; rationale?: string };
  insured: { name?: string; trade?: string; address?: string; turnover?: number };
  broker?: { name?: string; contact?: string };
  risk: { classOfBusiness?: string; inceptionDate?: string; coversRequested: string[] };
  productSubmission?: {
    productType: "property_owners";
    productData: PropertyOwnersProductData;
  };
  dataQuality: {
    missingFields: string[];
    warnings: string[];
    confidence: number;
    evidence?: Array<{ field: string; label?: string; evidence?: string; confidence: number }>;
  };
};

type QuoteSummary = {
  quoteId: string;
  status: Quote["status"];
  createdAt: string;
  productType: Quote["productType"];
  underwriterName?: string;
  insuredName?: string;
  brokerName?: string;
  classOfBusiness?: string;
};

type PropertyOwnersProductData = {
    product: "Property Owners Package";
    coverage: {
      buildingsAndLandlordContents?: number;
      lossOfRentMonths?: number;
      propertyOwnersLiability?: number;
      terrorismIncluded?: boolean;
      engineeringInspectionAndBreakdownRequested?: boolean;
    };
    locations: Array<{
      name: string;
      construction?: string;
      yearBuilt?: number;
      stories?: string;
      tiv?: number;
      occupancy?: string;
      notes?: string;
    }>;
    lossHistory: Array<{
      date?: string;
      type?: string;
      paid?: number;
      reserved?: number;
      description?: string;
    }>;
};

type ToolResult = {
  structuredContent?: unknown;
};

const API_BASE = "http://localhost:8787";
const isEmbeddedMcpApp = window.parent !== window;

function formatCurrency(value?: number) {
  if (!value) return "Missing";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

function formatProductType(productType: Quote["productType"]) {
  if (productType === "property_owners") return "Property Owners";
  return "Generic Commercial";
}

function getPropertyData(quote: Quote): PropertyOwnersProductData | null {
  if (quote.productSubmission?.productType === "property_owners") return quote.productSubmission.productData;
  return null;
}

function quoteFromToolResult(result: ToolResult): Quote | null {
  const structuredContent = result.structuredContent as Quote | undefined;
  if (!structuredContent || typeof structuredContent !== "object") return null;
  if ("quoteId" in structuredContent) return structuredContent;
  return null;
}

function quoteListFromToolResult(result: ToolResult): QuoteSummary[] | null {
  const structuredContent = result.structuredContent as { quotes?: QuoteSummary[] } | undefined;
  if (!structuredContent?.quotes) return null;
  return structuredContent.quotes;
}

function useQuote() {
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteList, setQuoteList] = React.useState<QuoteSummary[] | null>(null);
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

        const nextQuote = quoteFromToolResult(result);
        if (nextQuote) {
          setQuote(nextQuote);
          setQuoteList(null);
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

    const quoteId = new URLSearchParams(window.location.search).get("quoteId");
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

  async function loadQuote(quoteId: string) {
    if (mcpAppRef.current) {
      const result = await mcpAppRef.current.callServerTool({
        name: "get_quote",
        arguments: { quoteId }
      });
      const nextQuote = quoteFromToolResult(result);
      if (nextQuote) {
        setQuote(nextQuote);
        setQuoteList(null);
      }
      return;
    }

    const res = await fetch(`${API_BASE}/api/quotes/${quoteId}`);
    if (!res.ok) throw new Error("Quote not found");
    setQuote(await res.json());
    setQuoteList(null);
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
      const nextQuote = quoteFromToolResult(result);
      if (nextQuote) setQuote(nextQuote);
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
      const nextQuote = quoteFromToolResult(result);
      if (nextQuote) setQuote(nextQuote);
      return;
    }

    const res = await fetch(`${API_BASE}/api/quotes/${quote.quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    setQuote(await res.json());
  }

  return { quote, quoteList, error, isConnecting, loadQuote, loadQuoteList, updateStatus, updateQuote };
}

type InsuredEditorProps = {
  quote: Quote;
  onSave: (patch: Pick<Partial<Quote>, "insured">) => Promise<void>;
};

function InsuredEditor({ quote, onSave }: InsuredEditorProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [name, setName] = React.useState(quote.insured.name ?? "");
  const [trade, setTrade] = React.useState(quote.insured.trade ?? "");
  const [address, setAddress] = React.useState(quote.insured.address ?? "");
  const [turnover, setTurnover] = React.useState(quote.insured.turnover?.toString() ?? "");
  const [isSaving, setIsSaving] = React.useState(false);

  function resetForm() {
    setName(quote.insured.name ?? "");
    setTrade(quote.insured.trade ?? "");
    setAddress(quote.insured.address ?? "");
    setTurnover(quote.insured.turnover?.toString() ?? "");
  }

  async function saveInsured(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    const turnoverValue = Number(turnover.replace(/[£,\s]/g, ""));

    try {
      await onSave({
        insured: {
          name: name.trim() || undefined,
          trade: trade.trim() || undefined,
          address: address.trim() || undefined,
          turnover: Number.isFinite(turnoverValue) && turnover.trim() ? turnoverValue : undefined
        }
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <article className="card">
        <form className="edit-form" onSubmit={saveInsured}>
          <div className="card-heading">
            <h2>Insured</h2>
            <div className="icon-actions">
              <button className="icon-button" type="submit" aria-label="Save insured" disabled={isSaving}><Save size={18} /></button>
              <button
                className="icon-button"
                type="button"
                aria-label="Cancel editing insured"
                onClick={() => {
                  resetForm();
                  setIsEditing(false);
                }}
                disabled={isSaving}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Trade<input value={trade} onChange={(event) => setTrade(event.target.value)} /></label>
          <label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label>Turnover<input inputMode="decimal" value={turnover} onChange={(event) => setTurnover(event.target.value)} /></label>
        </form>
      </article>
    );
  }

  return (
    <article className="card">
      <div className="card-heading">
        <h2>Insured</h2>
        <button className="icon-button" type="button" aria-label="Edit insured" onClick={() => setIsEditing(true)}><Pencil size={18} /></button>
      </div>
      <dl>
        <dt>Name</dt><dd>{quote.insured.name ?? "Missing"}</dd>
        <dt>Trade</dt><dd>{quote.insured.trade ?? "Missing"}</dd>
        <dt>Address</dt><dd>{quote.insured.address ?? "Missing"}</dd>
        <dt>Turnover</dt><dd>{formatCurrency(quote.insured.turnover)}</dd>
      </dl>
    </article>
  );
}

function BrokerDetails({ quote }: { quote: Quote }) {
  return (
    <article className="card">
      <h2>Broker</h2>
      <dl>
        <dt>Name</dt><dd>{quote.broker?.name ?? "Missing"}</dd>
        <dt>Contact</dt><dd>{quote.broker?.contact ?? "Missing"}</dd>
      </dl>
    </article>
  );
}

function PropertyOwnersPanel({ quote }: { quote: Quote }) {
  const property = getPropertyData(quote);
  const [isLocationScheduleOpen, setIsLocationScheduleOpen] = React.useState(false);
  if (!property) return null;

  return (
    <>
      <article className="card property-summary">
        <h2>Property Coverage</h2>
        <dl>
          <dt>Buildings & Contents</dt><dd>{formatCurrency(property.coverage.buildingsAndLandlordContents)}</dd>
          <dt>Loss of Rent</dt><dd>{property.coverage.lossOfRentMonths ? `${property.coverage.lossOfRentMonths} months` : "Missing"}</dd>
          <dt>Owners Liability</dt><dd>{formatCurrency(property.coverage.propertyOwnersLiability)}</dd>
          <dt>Terrorism</dt><dd>{property.coverage.terrorismIncluded ? "Included" : "Not requested"}</dd>
          <dt>Engineering</dt><dd>{property.coverage.engineeringInspectionAndBreakdownRequested ? "Requested" : "Not requested"}</dd>
        </dl>
      </article>

      <article className="card table-card">
        <button
          className="section-toggle"
          type="button"
          aria-expanded={isLocationScheduleOpen}
          onClick={() => setIsLocationScheduleOpen((isOpen) => !isOpen)}
        >
          <span>
            <strong>Location Schedule</strong>
            <small>{property.locations.length} location{property.locations.length === 1 ? "" : "s"}</small>
          </span>
          <ChevronDown className={isLocationScheduleOpen ? "is-open" : ""} size={18} />
        </button>
        {isLocationScheduleOpen && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Construction</th>
                  <th>Year</th>
                  <th>Stories</th>
                  <th>TIV</th>
                  <th>Occupancy</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {property.locations.map((location) => (
                  <tr key={location.name}>
                    <td>{location.name}</td>
                    <td>{location.construction ?? "Missing"}</td>
                    <td>{location.yearBuilt ?? "Missing"}</td>
                    <td>{location.stories ?? "Missing"}</td>
                    <td>{formatCurrency(location.tiv)}</td>
                    <td>{location.occupancy ?? "Missing"}</td>
                    <td>{location.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="card table-card">
        <h2>Loss History</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Paid</th>
                <th>Reserved</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {property.lossHistory.map((loss, index) => (
                <tr key={`${loss.date}-${index}`}>
                  <td>{loss.date ?? "Missing"}</td>
                  <td>{loss.type ?? "Missing"}</td>
                  <td>{formatCurrency(loss.paid)}</td>
                  <td>{formatCurrency(loss.reserved)}</td>
                  <td>{loss.description ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}

const productRenderers: Record<string, (quote: Quote) => React.ReactNode> = {
  property_owners: (quote) => <PropertyOwnersPanel quote={quote} />
};

function ProductPanels({ quote }: { quote: Quote }) {
  const renderer = productRenderers[quote.productType];
  if (renderer) return <>{renderer(quote)}</>;
  return null;
}

type QuoteBrowserProps = {
  quotes: QuoteSummary[];
  onSelect: (quoteId: string) => Promise<void>;
  onFilter: (productType?: Quote["productType"]) => Promise<void>;
};

function QuoteBrowser({ quotes, onSelect, onFilter }: QuoteBrowserProps) {
  const [activeFilter, setActiveFilter] = React.useState<Quote["productType"] | "all">("all");
  const [expandedQuoteId, setExpandedQuoteId] = React.useState<string | null>(null);

  async function applyFilter(productType: Quote["productType"] | "all") {
    setActiveFilter(productType);
    await onFilter(productType === "all" ? undefined : productType);
  }

  return (
    <main className="shell browser-shell">
      <section className="hero browser-hero">
        <div>
          <p className="eyebrow">Quote Browser</p>
          <h1>Quotes</h1>
          <p className="muted">{quotes.length} quote{quotes.length === 1 ? "" : "s"} available</p>
        </div>
        <div className="filter-actions" role="group" aria-label="Filter quotes by product">
          <button className={activeFilter === "all" ? "active" : ""} type="button" onClick={() => applyFilter("all")}>All</button>
          <button className={activeFilter === "property_owners" ? "active" : ""} type="button" onClick={() => applyFilter("property_owners")}>Property</button>
          <button className={activeFilter === "generic_commercial" ? "active" : ""} type="button" onClick={() => applyFilter("generic_commercial")}>Generic</button>
        </div>
      </section>

      <section className="card table-card quote-browser">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quote</th>
                <th>Status</th>
                <th>Insured</th>
                <th>Broker</th>
                <th><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const isExpanded = expandedQuoteId === quote.quoteId;
                return (
                  <React.Fragment key={quote.quoteId}>
                    <tr>
                      <td>
                        <strong>{quote.quoteId}</strong>
                        <span className="mobile-detail">{formatProductType(quote.productType)}</span>
                      </td>
                      <td><span className={`status compact ${quote.status.toLowerCase().replaceAll(" ", "-")}`}>{quote.status}</span></td>
                      <td>{quote.insuredName ?? "Missing"}</td>
                      <td>{quote.brokerName ?? "Missing"}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`${isExpanded ? "Hide" : "Show"} details for ${quote.quoteId}`}
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedQuoteId(isExpanded ? null : quote.quoteId)}
                          >
                            <ChevronDown className={isExpanded ? "is-open" : ""} size={18} />
                          </button>
                          <button className="icon-button" type="button" aria-label={`Open ${quote.quoteId}`} onClick={() => onSelect(quote.quoteId)}>
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="quote-detail-row">
                        <td colSpan={5}>
                          <dl className="quote-detail-list">
                            <dt>Product</dt><dd>{formatProductType(quote.productType)}</dd>
                            <dt>Class</dt><dd>{quote.classOfBusiness ?? "Missing"}</dd>
                            <dt>Underwriter</dt><dd>{quote.underwriterName ?? "Unallocated"}</dd>
                            <dt>Created</dt><dd>{new Date(quote.createdAt).toLocaleString()}</dd>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">No quotes found for this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function App() {
  const { quote, quoteList, error, isConnecting, loadQuote, loadQuoteList, updateStatus, updateQuote } = useQuote();
  const [reviewWorkflowState, setReviewWorkflowState] = React.useState<"idle" | "processing" | "complete">("idle");

  if (error) return <main className="shell error"><h1>Unable to load quote</h1><p>{error}</p></main>;
  if (quoteList) return <QuoteBrowser quotes={quoteList} onSelect={loadQuote} onFilter={loadQuoteList} />;
  if (!quote) return <main className="shell"><h1>{isConnecting ? "Connecting quote app..." : "Loading quote record..."}</h1></main>;

  const confidence = Math.round(quote.dataQuality.confidence * 100);
  const isReviewAcknowledged = reviewWorkflowState === "complete" || quote.status === "In Review";

  async function sendToUnderwritingReview() {
    setReviewWorkflowState("processing");
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    await updateStatus("In Review");
    setReviewWorkflowState("complete");
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">AI Native Submission Intake</p>
          <h1>Quote {quote.quoteId}</h1>
          <p className="muted">Created {new Date(quote.createdAt).toLocaleString()}</p>
        </div>
        <span className={`status ${quote.status.toLowerCase().replaceAll(" ", "-")}`}>{quote.status}</span>
      </section>

      <section className="quote-summary-card" aria-label="Quote summary">
        <div className="summary-item"><FileText size={17} /><span>Class</span><strong>{quote.risk.classOfBusiness ?? "Missing"}</strong></div>
        <div className="summary-item"><ShieldCheck size={17} /><span>Confidence</span><strong>{confidence}%</strong></div>
        <div className="summary-item"><AlertTriangle size={17} /><span>Missing Fields</span><strong>{quote.dataQuality.missingFields.length}</strong></div>
        <div className="summary-item"><CheckCircle2 size={17} /><span>Covers</span><strong>{quote.risk.coversRequested.length}</strong></div>
      </section>

      <section className="party-details">
        <InsuredEditor quote={quote} onSave={updateQuote} />
        <BrokerDetails quote={quote} />
      </section>

      <section className="content-grid">
        <article className="card">
          <h2>Risk</h2>
          <dl>
            <dt>Inception Date</dt><dd>{quote.risk.inceptionDate ?? "Missing"}</dd>
          </dl>
        </article>

        <article className={`card allocation-card ${reviewWorkflowState === "processing" ? "is-processing" : ""}`}>
          <h2>Underwriter Allocation</h2>
          {reviewWorkflowState === "processing" ? (
            <div className="processing-state">
              <span className="spinner" aria-hidden="true"></span>
              <strong>Routing to underwriting review</strong>
              <p className="muted">Checking product, class, and referral signals.</p>
            </div>
          ) : quote.underwriter ? (
            <dl>
              <dt>Name</dt><dd>{quote.underwriter.name}</dd>
              <dt>Team</dt><dd>{quote.underwriter.team}</dd>
              <dt>Email</dt><dd>{quote.underwriter.email}</dd>
              <dt>Allocated</dt><dd>{new Date(quote.underwriter.allocatedAt).toLocaleString()}</dd>
              <dt>Reason</dt><dd>{quote.underwriter.rationale ?? "Allocated for underwriting review."}</dd>
            </dl>
          ) : (
            <p className="muted">No underwriter allocated yet.</p>
          )}
        </article>

        <article className="card">
          <h2>Covers Requested</h2>
          <div className="pill-list">
            {quote.risk.coversRequested.map((cover) => <span className="pill" key={cover}>{cover}</span>)}
          </div>
        </article>

        <ProductPanels quote={quote} />

        <article className="card warning-card">
          <h2>Data Quality</h2>
          <h3>Missing</h3>
          <ul>{quote.dataQuality.missingFields.map((field) => <li key={field}>{field}</li>)}</ul>
          <h3>Warnings</h3>
          <ul>{quote.dataQuality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </article>

        <article className="card actions">
          <h2>Underwriting Actions</h2>
          <button
            className={`review-button ${isReviewAcknowledged ? "is-complete" : ""}`}
            onClick={sendToUnderwritingReview}
            disabled={reviewWorkflowState === "processing"}
          >
            {isReviewAcknowledged ? <CheckCircle2 size={18} /> : <Send size={18} />}
            {isReviewAcknowledged ? " Sent to underwriting review" : " Send to underwriting review"}
          </button>
          <button onClick={() => updateStatus("Quoted")}><CheckCircle2 size={18} /> Mark as quoted</button>
          <button onClick={() => updateStatus("Declined")}><AlertTriangle size={18} /> Decline risk</button>
        </article>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
