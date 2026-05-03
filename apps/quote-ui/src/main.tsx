import React from "react";
import ReactDOM from "react-dom/client";
import { AlertTriangle, CheckCircle2, FileText, Send, ShieldCheck } from "lucide-react";
import "./styles.css";

type Quote = {
  quoteId: string;
  status: "Draft" | "In Review" | "Quoted" | "Declined";
  createdAt: string;
  insured: { name?: string; trade?: string; address?: string; turnover?: number };
  broker?: { name?: string; contact?: string };
  risk: { classOfBusiness?: string; inceptionDate?: string; coversRequested: string[] };
  dataQuality: { missingFields: string[]; warnings: string[]; confidence: number };
};

const API_BASE = "http://localhost:8787";

function formatCurrency(value?: number) {
  if (!value) return "Missing";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

function useQuote() {
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const quoteId = new URLSearchParams(window.location.search).get("quoteId");

  React.useEffect(() => {
    if (!quoteId) {
      setError("No quoteId provided in the URL.");
      return;
    }
    fetch(`${API_BASE}/api/quotes/${quoteId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Quote not found");
        return res.json();
      })
      .then(setQuote)
      .catch((err) => setError(err.message));
  }, [quoteId]);

  async function updateStatus(status: Quote["status"]) {
    if (!quote) return;
    const res = await fetch(`${API_BASE}/api/quotes/${quote.quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    setQuote(await res.json());
  }

  return { quote, error, updateStatus };
}

function App() {
  const { quote, error, updateStatus } = useQuote();

  if (error) return <main className="shell error"><h1>Unable to load quote</h1><p>{error}</p></main>;
  if (!quote) return <main className="shell"><h1>Loading quote record…</h1></main>;

  const confidence = Math.round(quote.dataQuality.confidence * 100);

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

      <section className="summary-grid">
        <article className="metric-card"><FileText /><span>Class</span><strong>{quote.risk.classOfBusiness ?? "Missing"}</strong></article>
        <article className="metric-card"><ShieldCheck /><span>Confidence</span><strong>{confidence}%</strong></article>
        <article className="metric-card"><AlertTriangle /><span>Missing Fields</span><strong>{quote.dataQuality.missingFields.length}</strong></article>
        <article className="metric-card"><CheckCircle2 /><span>Covers</span><strong>{quote.risk.coversRequested.length}</strong></article>
      </section>

      <section className="content-grid">
        <article className="card">
          <h2>Insured</h2>
          <dl>
            <dt>Name</dt><dd>{quote.insured.name ?? "Missing"}</dd>
            <dt>Trade</dt><dd>{quote.insured.trade ?? "Missing"}</dd>
            <dt>Address</dt><dd>{quote.insured.address ?? "Missing"}</dd>
            <dt>Turnover</dt><dd>{formatCurrency(quote.insured.turnover)}</dd>
          </dl>
        </article>

        <article className="card">
          <h2>Broker & Risk</h2>
          <dl>
            <dt>Broker</dt><dd>{quote.broker?.name ?? "Missing"}</dd>
            <dt>Contact</dt><dd>{quote.broker?.contact ?? "Missing"}</dd>
            <dt>Inception Date</dt><dd>{quote.risk.inceptionDate ?? "Missing"}</dd>
          </dl>
        </article>

        <article className="card">
          <h2>Covers Requested</h2>
          <div className="pill-list">
            {quote.risk.coversRequested.map((cover) => <span className="pill" key={cover}>{cover}</span>)}
          </div>
        </article>

        <article className="card warning-card">
          <h2>Data Quality</h2>
          <h3>Missing</h3>
          <ul>{quote.dataQuality.missingFields.map((field) => <li key={field}>{field}</li>)}</ul>
          <h3>Warnings</h3>
          <ul>{quote.dataQuality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </article>

        <article className="card actions">
          <h2>Underwriting Actions</h2>
          <button onClick={() => updateStatus("In Review")}><Send size={18} /> Send to underwriting review</button>
          <button onClick={() => updateStatus("Quoted")}><CheckCircle2 size={18} /> Mark as quoted</button>
          <button onClick={() => updateStatus("Declined")}><AlertTriangle size={18} /> Decline risk</button>
        </article>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
