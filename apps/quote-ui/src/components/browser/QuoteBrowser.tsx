import React from "react";
import { ChevronDown, Eye } from "lucide-react";
import type { Quote, QuoteSummary } from "../../types";
import { formatProductType } from "../../utils/formatting";

type QuoteBrowserProps = {
  quotes: QuoteSummary[];
  onSelect: (quoteId: string) => Promise<void>;
  onFilter: (productType?: Quote["productType"]) => Promise<void>;
};

export function QuoteBrowser({ quotes, onSelect, onFilter }: QuoteBrowserProps) {
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
