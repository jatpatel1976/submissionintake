import React from "react";
import ReactDOM from "react-dom/client";
import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeChange,
  type NodeProps,
  type OnNodeDrag
} from "@xyflow/react";
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, FileText, GitBranch, Minus, Pencil, Plus, RotateCcw, Save, Send, ShieldCheck, X } from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./styles.css";

type DataQuality = {
  missingFields: string[];
  warnings: string[];
  confidence: number;
  evidence?: Array<{ field: string; label?: string; evidence?: string; confidence: number }>;
};

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
    sourceFile?: string;
    productType: "property_owners";
    productData: PropertyOwnersProductData;
    dataQuality?: DataQuality;
  };
  dataQuality: DataQuality;
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
    insured?: {
      name?: string;
      industryCode?: string;
      revenueOrTurnover?: number;
      revenueBasis?: string;
      employees?: number;
      operationsOrLocations?: string;
    };
    broker?: {
      name?: string;
      contact?: string;
      email?: string;
      phone?: string;
      submissionReference?: string;
      proposedEffectiveDate?: string;
      marketDeadline?: string;
    };
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
    attachments?: Array<{
      name: string;
      status?: string;
      potentialIssue?: string;
    }>;
    underwriting?: {
      requestedCommonRenewalDate?: string;
      escapeOfWaterDeductibleCap?: number;
      accountMarketingBasis?: string;
      brokerInstructions?: string;
    };
};

type ToolResult = {
  structuredContent?: unknown;
};

type ViewMode = "record" | "data_points" | "graph";
type DetailViewMode = Exclude<ViewMode, "graph">;

const API_BASE = "http://localhost:8787";
const isEmbeddedMcpApp = window.parent !== window;

function formatCurrency(value?: number) {
  if (value === undefined) return "Missing";
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

function useQuote() {
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

function formatPercent(value?: number) {
  if (value === undefined) return "";
  return `${Math.round(value * 100)}%`;
}

function formatBoolean(value?: boolean, trueText = "Included", falseText = "Not requested") {
  if (value === undefined) return "Missing";
  return value ? trueText : falseText;
}

function getEvidence(dataQuality: DataQuality, field: string) {
  return dataQuality.evidence?.find((item) => item.field === field);
}

type DataPointRowProps = {
  label: string;
  value?: React.ReactNode;
  evidence?: { evidence?: string; confidence: number };
  missing?: boolean;
};

function DataPointRow({ label, value, evidence, missing }: DataPointRowProps) {
  const isMissing = missing || value === undefined || value === null || value === "";
  return (
    <div className="data-point-row">
      <dt>{label}</dt>
      <dd>
        <strong className={isMissing ? "missing-value" : ""}>{isMissing ? "Not provided" : value}</strong>
        {evidence?.evidence && <small>{evidence.evidence}</small>}
      </dd>
      <span className={`confidence-badge ${isMissing ? "is-missing" : ""}`}>
        {isMissing ? "missing" : evidence ? formatPercent(evidence.confidence) : "-"}
      </span>
    </div>
  );
}

function DataPointSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="data-point-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type GraphCenter = "insured" | "risk" | "broker";
type RagStatus = "red" | "amber" | "green";
type GraphGroup = "coverage" | "locations" | "lossHistory" | "attachments" | "quality";
type NodePosition = { x: number; y: number };

type EntityNode = {
  id: string;
  type: "insured" | "broker" | "risk" | "coverage" | "location" | "loss" | "attachment" | "underwriting" | "quality" | "group";
  label: string;
  subtitle?: string;
  confidence?: number;
  rag: RagStatus;
  detailView: DetailViewMode;
  groupKey?: GraphGroup;
  isGroup?: boolean;
  isExpanded?: boolean;
  childCount?: number;
  parentId?: string;
};

type EntityEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

type PositionedEntityNode = EntityNode & {
  x: number;
  y: number;
};

type EntityNodeData = EntityNode & {
  isCenter: boolean;
};

type EntityFlowNode = FlowNode<EntityNodeData, "entity">;
type EntityFlowEdge = FlowEdge<{ label: string }>;
type NodeRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const FLOW_WIDTH = 1000;
const FLOW_HEIGHT = 650;

function normalizeField(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]/g, "");
}

function confidenceForFields(dataQuality: DataQuality, fields: string[]) {
  const normalizedFields = fields.map(normalizeField);
  const matches = dataQuality.evidence?.filter((item) => normalizedFields.some((field) => normalizeField(item.field).includes(field)));
  if (!matches?.length) return dataQuality.confidence;
  return Math.min(...matches.map((item) => item.confidence));
}

function hasMissingField(dataQuality: DataQuality, fields: string[]) {
  const normalizedFields = fields.map(normalizeField);
  return dataQuality.missingFields.some((missingField) => normalizedFields.some((field) => normalizeField(missingField).includes(field)));
}

function hasWarningSignal(dataQuality: DataQuality, searchTerms: string[]) {
  const normalizedTerms = searchTerms.map((term) => term.toLowerCase()).filter(Boolean);
  return dataQuality.warnings.some((warning) => normalizedTerms.some((term) => warning.toLowerCase().includes(term)));
}

function ragForEntity(dataQuality: DataQuality, fields: string[], searchTerms: string[] = []): { rag: RagStatus; confidence: number } {
  const confidence = confidenceForFields(dataQuality, fields);
  if (hasMissingField(dataQuality, fields) || confidence < 0.6) return { rag: "red", confidence };
  if (confidence < 0.85 || hasWarningSignal(dataQuality, searchTerms)) return { rag: "amber", confidence };
  return { rag: "green", confidence };
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sumNumbers(values: Array<number | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function buildQuoteGraph(quote: Quote, center: GraphCenter, expandedGroups: Set<GraphGroup>): { nodes: PositionedEntityNode[]; edges: EntityEdge[] } {
  const property = getPropertyData(quote);
  const dataQuality = quote.productSubmission?.dataQuality ?? quote.dataQuality;
  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];

  function addNode(node: EntityNode) {
    if (!nodes.some((existing) => existing.id === node.id)) nodes.push(node);
  }

  function addEdge(source: string, target: string, label: string) {
    if (source === target) return;
    const id = `${source}-${target}-${label}`;
    if (!edges.some((edge) => edge.id === id)) edges.push({ id, source, target, label });
  }

  function isExpanded(groupKey: GraphGroup) {
    return expandedGroups.has(groupKey);
  }

  function addGroupNode(node: Omit<EntityNode, "isGroup" | "isExpanded"> & { groupKey: GraphGroup }) {
    addNode({
      ...node,
      type: node.type,
      isGroup: true,
      isExpanded: isExpanded(node.groupKey)
    });
  }

  const insuredQuality = ragForEntity(dataQuality, ["insured"], [quote.insured.name ?? "", property?.insured?.name ?? ""]);
  addNode({
    id: "insured",
    type: "insured",
    label: quote.insured.name ?? property?.insured?.name ?? "Insured",
    subtitle: quote.insured.trade ?? property?.insured?.industryCode ?? "Named insured",
    detailView: "record",
    ...insuredQuality
  });

  const brokerQuality = ragForEntity(dataQuality, ["broker"], [quote.broker?.name ?? "", property?.broker?.name ?? ""]);
  addNode({
    id: "broker",
    type: "broker",
    label: quote.broker?.name ?? property?.broker?.name ?? "Broker",
    subtitle: quote.broker?.contact ?? property?.broker?.email ?? "Broker details",
    detailView: "record",
    ...brokerQuality
  });

  const riskQuality = ragForEntity(dataQuality, ["risk"], [quote.risk.classOfBusiness ?? ""]);
  addNode({
    id: "risk",
    type: "risk",
    label: quote.risk.classOfBusiness ?? "Risk",
    subtitle: quote.risk.inceptionDate ? `Inception ${quote.risk.inceptionDate}` : "Risk details",
    detailView: "record",
    ...riskQuality
  });

  addEdge("insured", "broker", "submitted via");
  addEdge("insured", "risk", "has risk");
  addEdge("broker", "risk", "placed");

  const coverQuality = ragForEntity(dataQuality, ["coverage"], quote.risk.coversRequested);
  addGroupNode({
    id: "coverage",
    type: "coverage",
    label: property ? "Property coverage" : "Covers requested",
    subtitle: `${quote.risk.coversRequested.length} cover${quote.risk.coversRequested.length === 1 ? "" : "s"}`,
    detailView: "data_points",
    groupKey: "coverage",
    childCount: quote.risk.coversRequested.length,
    ...coverQuality
  });
  addEdge("risk", "coverage", "requests");

  if (isExpanded("coverage")) {
    quote.risk.coversRequested.forEach((cover, index) => {
      addNode({
        id: `coverage-${index}`,
        type: "coverage",
        label: cover,
        subtitle: property?.coverage.buildingsAndLandlordContents && index === 0 ? formatCurrency(property.coverage.buildingsAndLandlordContents) : "Cover line",
        detailView: "data_points",
        parentId: "coverage",
        ...coverQuality
      });
      addEdge("coverage", `coverage-${index}`, "includes");
    });
  }

  if (property) {
    const underwritingQuality = ragForEntity(dataQuality, ["underwriting"], [property.underwriting?.brokerInstructions ?? ""]);
    addNode({
      id: "underwriting",
      type: "underwriting",
      label: "Underwriting data",
      subtitle: property.underwriting?.accountMarketingBasis ?? "Review requirements",
      detailView: "data_points",
      ...underwritingQuality
    });
    addEdge("risk", "underwriting", "reviewed against");

    const locationQuality = ragForEntity(dataQuality, ["locations"], property.locations.flatMap((location) => [location.name, location.notes ?? "", location.occupancy ?? ""]));
    const totalTiv = sumNumbers(property.locations.map((location) => location.tiv));
    addGroupNode({
      id: "locations",
      type: "location",
      label: "Locations",
      subtitle: totalTiv ? `${formatCount(property.locations.length, "location")} - ${formatCurrency(totalTiv)}` : formatCount(property.locations.length, "location"),
      detailView: "data_points",
      groupKey: "locations",
      childCount: property.locations.length,
      ...locationQuality
    });
    addEdge("risk", "locations", "exposes");

    if (isExpanded("locations")) property.locations.slice(0, 10).forEach((location, index) => {
      const id = `location-${index}`;
      addNode({
        id,
        type: "location",
        label: location.name,
        subtitle: location.tiv ? `TIV ${formatCurrency(location.tiv)}` : location.occupancy ?? "Location",
        detailView: "data_points",
        parentId: "locations",
        ...locationQuality
      });
      addEdge("locations", id, "premises");
    });

    const lossQuality = ragForEntity(dataQuality, ["losshistory"], property.lossHistory.flatMap((loss) => [loss.type ?? "", loss.description ?? ""]));
    const totalLossPaid = sumNumbers(property.lossHistory.map((loss) => loss.paid));
    addGroupNode({
      id: "loss-history",
      type: "loss",
      label: "Loss history",
      subtitle: totalLossPaid ? `${formatCount(property.lossHistory.length, "loss", "losses")} - paid ${formatCurrency(totalLossPaid)}` : formatCount(property.lossHistory.length, "loss", "losses"),
      detailView: "data_points",
      groupKey: "lossHistory",
      childCount: property.lossHistory.length,
      ...lossQuality
    });
    addEdge("risk", "loss-history", "loss history");

    if (isExpanded("lossHistory")) property.lossHistory.slice(0, 8).forEach((loss, index) => {
      const id = `loss-${index}`;
      addNode({
        id,
        type: "loss",
        label: loss.type ?? `Loss ${index + 1}`,
        subtitle: [loss.date, formatCurrency(loss.paid)].filter(Boolean).join(" - "),
        detailView: "data_points",
        parentId: "loss-history",
        ...lossQuality
      });
      addEdge("loss-history", id, "entry");
    });

    if (property.attachments?.length) {
      const issueCount = property.attachments.filter((attachment) => attachment.potentialIssue).length;
      addGroupNode({
        id: "attachments",
        type: "attachment",
        label: "Attachments",
        subtitle: issueCount ? `${formatCount(property.attachments.length, "file")} - ${formatCount(issueCount, "issue")}` : formatCount(property.attachments.length, "file"),
        confidence: dataQuality.confidence,
        rag: issueCount ? "amber" : "green",
        detailView: "data_points",
        groupKey: "attachments",
        childCount: property.attachments.length
      });
      addEdge("risk", "attachments", "supported by");

      if (isExpanded("attachments")) property.attachments.slice(0, 8).forEach((attachment, index) => {
        const isIssue = Boolean(attachment.potentialIssue);
        const id = `attachment-${index}`;
        addNode({
          id,
          type: "attachment",
          label: attachment.name,
          subtitle: attachment.potentialIssue ?? attachment.status ?? "Attachment",
          confidence: dataQuality.confidence,
          rag: isIssue ? "amber" : "green",
          detailView: "data_points",
          parentId: "attachments"
        });
        addEdge("attachments", id, "file");
      });
    }
  }

  if (dataQuality.missingFields.length || dataQuality.warnings.length) {
    addGroupNode({
      id: "quality",
      type: "quality",
      label: "Data quality",
      subtitle: `${dataQuality.missingFields.length} missing, ${dataQuality.warnings.length} warning${dataQuality.warnings.length === 1 ? "" : "s"}`,
      confidence: dataQuality.confidence,
      rag: dataQuality.missingFields.length ? "red" : "amber",
      detailView: "data_points",
      groupKey: "quality",
      childCount: Number(dataQuality.missingFields.length > 0) + Number(dataQuality.warnings.length > 0)
    });
    addEdge("risk", "quality", "flags");

    if (isExpanded("quality")) {
      if (dataQuality.missingFields.length) {
        addNode({
          id: "quality-missing",
          type: "quality",
          label: "Missing fields",
          subtitle: dataQuality.missingFields.slice(0, 3).join(", "),
          confidence: dataQuality.confidence,
          rag: "red",
          detailView: "data_points",
          parentId: "quality"
        });
        addEdge("quality", "quality-missing", "missing");
      }
      if (dataQuality.warnings.length) {
        addNode({
          id: "quality-warnings",
          type: "quality",
          label: "Warnings",
          subtitle: dataQuality.warnings.slice(0, 2).join("; "),
          confidence: dataQuality.confidence,
          rag: "amber",
          detailView: "data_points",
          parentId: "quality"
        });
        addEdge("quality", "quality-warnings", "review");
      }
    }
  }

  const centerIndex = nodes.findIndex((node) => node.id === center);
  const orderedNodes = centerIndex >= 0
    ? [nodes[centerIndex], ...nodes.slice(0, centerIndex), ...nodes.slice(centerIndex + 1)]
    : nodes;

  const positioned: PositionedEntityNode[] = [];
  orderedNodes.forEach((node, index) => {
    if (index === 0) {
      positioned.push({ ...node, x: 50, y: 50 });
      return;
    }
    if (node.parentId) {
      const parent = positioned.find((candidate) => candidate.id === node.parentId);
      const siblings = orderedNodes.filter((candidate) => candidate.parentId === node.parentId);
      const siblingIndex = siblings.findIndex((candidate) => candidate.id === node.id);
      const angle = (siblingIndex / Math.max(siblings.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const parentX = parent?.x ?? 50;
      const parentY = parent?.y ?? 50;
      positioned.push({
        ...node,
        x: Math.max(8, Math.min(92, parentX + Math.cos(angle) * 18)),
        y: Math.max(10, Math.min(90, parentY + Math.sin(angle) * 15))
      });
      return;
    }
    const topLevelNodes = orderedNodes.filter((candidate) => !candidate.parentId).slice(1);
    const topLevelIndex = topLevelNodes.findIndex((candidate) => candidate.id === node.id);
    const angle = (topLevelIndex / Math.max(topLevelNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const isPrimary = ["insured", "broker", "risk", "coverage", "quality", "locations", "loss-history", "attachments"].includes(node.id);
    const radiusX = isPrimary ? 31 : 38;
    const radiusY = isPrimary ? 25 : 32;
    positioned.push({
      ...node,
      x: 50 + Math.cos(angle) * radiusX,
      y: 50 + Math.sin(angle) * radiusY
    });
  });

  return { nodes: positioned, edges };
}

function nodeDimensions(node: EntityNode, isCenter = false) {
  if (isCenter) return { width: 180, height: 102 };
  if (node.isGroup) return { width: 150, height: 76 };
  return { width: 156, height: 86 };
}

function graphPositionToFlowPosition(node: PositionedEntityNode, isCenter: boolean) {
  const { width, height } = nodeDimensions(node, isCenter);
  return {
    x: (node.x / 100) * FLOW_WIDTH - width / 2,
    y: (node.y / 100) * FLOW_HEIGHT - height / 2
  };
}

function entityToFlowNode(node: PositionedEntityNode, center: GraphCenter, savedPosition?: NodePosition): EntityFlowNode {
  const isCenter = node.id === center;
  return {
    id: node.id,
    type: "entity",
    position: savedPosition ?? graphPositionToFlowPosition(node, isCenter),
    data: {
      ...node,
      isCenter
    }
  };
}

function getFlowNodeRectangle(node: EntityFlowNode): NodeRectangle {
  const dimensions = nodeDimensions(node.data, node.data.isCenter);
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.width ?? dimensions.width,
    height: node.height ?? dimensions.height
  };
}

function sideFacingTarget(sourceRect: NodeRectangle, targetRect: NodeRectangle) {
  const sourceCenter = getNodeCenter(sourceRect);
  const targetCenter = getNodeCenter(targetRect);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left;
  return dy >= 0 ? Position.Bottom : Position.Top;
}

function handleId(type: "source" | "target", position: Position) {
  return `${type}-${position}`;
}

function entityToFlowEdge(edge: EntityEdge, selectedNodeId: string, flowNodesById: Map<string, EntityFlowNode>): EntityFlowEdge {
  const isSelectedEdge = edge.source === selectedNodeId || edge.target === selectedNodeId;
  const sourceNode = flowNodesById.get(edge.source);
  const targetNode = flowNodesById.get(edge.target);
  const sourceSide = sourceNode && targetNode ? sideFacingTarget(getFlowNodeRectangle(sourceNode), getFlowNodeRectangle(targetNode)) : Position.Bottom;
  const targetSide = sourceNode && targetNode ? sideFacingTarget(getFlowNodeRectangle(targetNode), getFlowNodeRectangle(sourceNode)) : Position.Top;

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "default",
    sourceHandle: handleId("source", sourceSide),
    targetHandle: handleId("target", targetSide),
    label: edge.label,
    data: { label: edge.label },
    className: isSelectedEdge ? "is-selected-edge" : undefined,
    markerEnd: {
      type: MarkerType.ArrowClosed
    }
  };
}

function getNodeCenter(rect: NodeRectangle) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

const EntityFlowNodeCard = React.memo(function EntityFlowNodeCard({ data, selected }: NodeProps<EntityFlowNode>) {
  return (
    <div
      className={`entity-flow-node ${data.rag} ${data.isCenter ? "is-center" : ""} ${selected ? "is-selected" : ""} ${data.isGroup ? "is-group" : ""} ${data.isExpanded ? "is-expanded" : ""}`}
    >
      <Handle className="entity-flow-handle" type="target" position={Position.Top} id="target-top" />
      <Handle className="entity-flow-handle" type="target" position={Position.Right} id="target-right" />
      <Handle className="entity-flow-handle" type="target" position={Position.Bottom} id="target-bottom" />
      <Handle className="entity-flow-handle" type="target" position={Position.Left} id="target-left" />
      <Handle className="entity-flow-handle" type="source" position={Position.Top} id="source-top" />
      <Handle className="entity-flow-handle" type="source" position={Position.Right} id="source-right" />
      <Handle className="entity-flow-handle" type="source" position={Position.Bottom} id="source-bottom" />
      <Handle className="entity-flow-handle" type="source" position={Position.Left} id="source-left" />
      <span className="entity-node-topline">
        <span className="entity-node-type">{data.isGroup ? "group" : data.type}</span>
        {data.isGroup && <span className="entity-node-count">{data.isExpanded ? <Minus size={12} /> : <Plus size={12} />}{data.childCount}</span>}
      </span>
      <strong>{data.label}</strong>
      {data.subtitle && <small>{data.subtitle}</small>}
      {selected && <span className="entity-node-confidence">{formatPercent(data.confidence)}</span>}
    </div>
  );
});

const nodeTypes = { entity: EntityFlowNodeCard };

function EntityGraphView({ quote, onViewChange }: { quote: Quote; onViewChange: (view: ViewMode) => void }) {
  const [center, setCenter] = React.useState<GraphCenter>("insured");
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>("insured");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<GraphGroup>>(() => new Set());
  const [nodePositions, setNodePositions] = React.useState<Record<string, NodePosition>>({});
  const graph = React.useMemo(() => {
    const builtGraph = buildQuoteGraph(quote, center, expandedGroups);
    const nodes = builtGraph.nodes;
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    return {
      ...builtGraph,
      nodes,
      nodesById
    };
  }, [quote, center, expandedGroups]);
  const [flowNodes, setFlowNodes] = React.useState<EntityFlowNode[]>(() => (
    graph.nodes.map((node) => entityToFlowNode(node, center, nodePositions[node.id]))
  ));
  const selectedNode = graph.nodesById.get(selectedNodeId) ?? graph.nodes[0];
  const flowEdges = React.useMemo(
    () => {
      const flowNodesById = new Map(flowNodes.map((node) => [node.id, node]));
      return graph.edges.map((edge) => entityToFlowEdge(edge, selectedNode.id, flowNodesById));
    },
    [flowNodes, graph.edges, selectedNode.id]
  );

  React.useEffect(() => {
    if (!graph.nodesById.has(selectedNodeId)) {
      setSelectedNodeId(graph.nodes[0]?.id ?? "insured");
    }
  }, [graph.nodes, graph.nodesById, selectedNodeId]);

  React.useEffect(() => {
    setFlowNodes(graph.nodes.map((node) => entityToFlowNode(node, center, nodePositions[node.id])));
  }, [center, graph.nodes, nodePositions]);

  function openNode(node: EntityNode) {
    onViewChange(node.detailView);
  }

  function toggleGroup(groupKey: GraphGroup) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function resetLayout() {
    setNodePositions({});
    setExpandedGroups(new Set());
    setSelectedNodeId(center);
  }

  function handleNodesChange(changes: NodeChange<EntityFlowNode>[]) {
    setFlowNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }

  const handleNodeDragStop: OnNodeDrag<EntityFlowNode> = (_event, node) => {
    setNodePositions((current) => ({
      ...current,
      [node.id]: node.position
    }));
  };

  return (
    <main className="shell graph-shell">
      <section className="hero graph-hero">
        <div>
          <p className="eyebrow">Entity Graph</p>
          <h1>{quote.quoteId}</h1>
          <p className="muted">{quote.insured.name ?? "Submission entities"}</p>
        </div>
        <div className="hero-actions">
          <div className="view-actions" role="group" aria-label="Quote view">
            <button type="button" onClick={() => onViewChange("record")}>Record</button>
            <button type="button" onClick={() => onViewChange("data_points")}>Data Points</button>
            <button className="active" type="button" onClick={() => onViewChange("graph")}><GitBranch size={14} /> Graph</button>
          </div>
        </div>
      </section>

      <section className="graph-toolbar" aria-label="Graph controls">
        <div className="center-actions" role="group" aria-label="Graph center">
          <button className={center === "insured" ? "active" : ""} type="button" onClick={() => setCenter("insured")}>Insured</button>
          <button className={center === "risk" ? "active" : ""} type="button" onClick={() => setCenter("risk")}>Risk</button>
          <button className={center === "broker" ? "active" : ""} type="button" onClick={() => setCenter("broker")}>Broker</button>
        </div>
        <button className="reset-layout-button" type="button" onClick={resetLayout}><RotateCcw size={14} /> Reset layout</button>
        <div className="rag-legend" aria-label="RAG legend">
          <span><i className="rag-dot green"></i>High</span>
          <span><i className="rag-dot amber"></i>Review</span>
          <span><i className="rag-dot red"></i>Low</span>
        </div>
      </section>

      <section className="entity-graph-layout">
        <div className="entity-graph-canvas" aria-label="Submission entity relationship graph">
          <ReactFlow<EntityFlowNode, EntityFlowEdge>
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
            onNodeDoubleClick={(_event, node) => openNode(node.data)}
            onNodeDragStop={handleNodeDragStop}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.45}
            maxZoom={1.4}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
          >
            <Background color="#ffffff1f" gap={32} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const rag = node.data.rag;
                if (rag === "green") return "#2fb389";
                if (rag === "red") return "#d96f5d";
                return "#d9a46f";
              }}
              maskColor="rgba(36, 35, 33, 0.72)"
            />
          </ReactFlow>
        </div>

        <aside className="entity-detail-panel">
          <span className={`rag-pill ${selectedNode.rag}`}>{selectedNode.rag}</span>
          <h2>{selectedNode.label}</h2>
          <p className="muted">{selectedNode.subtitle ?? selectedNode.type}</p>
          <dl>
            <dt>Entity</dt><dd>{selectedNode.type}</dd>
            <dt>Accuracy</dt><dd>{formatPercent(selectedNode.confidence) || "Unknown"}</dd>
            {selectedNode.isGroup && <><dt>Entries</dt><dd>{selectedNode.childCount ?? 0}</dd></>}
            <dt>Detail</dt><dd>{selectedNode.detailView === "record" ? "Quote record" : "Data points"}</dd>
          </dl>
          {selectedNode.groupKey && (
            <button type="button" onClick={() => toggleGroup(selectedNode.groupKey!)}>
              {selectedNode.isExpanded ? <Minus size={16} /> : <Plus size={16} />}
              {selectedNode.isExpanded ? "Collapse group" : "Expand group"}
            </button>
          )}
          <button type="button" onClick={() => openNode(selectedNode)}>Open detail</button>
        </aside>
      </section>
    </main>
  );
}

function DataPointsView({ quote, onViewChange }: { quote: Quote; onViewChange: (view: ViewMode) => void }) {
  const property = getPropertyData(quote);
  const dataQuality = quote.productSubmission?.dataQuality ?? quote.dataQuality;
  const sourceFile = quote.productSubmission?.sourceFile;
  const confidence = formatPercent(dataQuality.confidence);

  return (
    <main className="shell data-points-shell">
      <section className="hero data-points-hero">
        <div>
          <p className="eyebrow">Extracted Data Points</p>
          <h1>{quote.quoteId}</h1>
          <p className="muted">{sourceFile ?? quote.insured.name ?? "Quote record"}</p>
        </div>
        <div className="view-actions" role="group" aria-label="Quote view">
          <button type="button" onClick={() => onViewChange("record")}>Record</button>
          <button className="active" type="button" onClick={() => onViewChange("data_points")}>Data Points</button>
          <button type="button" onClick={() => onViewChange("graph")}><GitBranch size={14} /> Graph</button>
        </div>
      </section>

      <section className="confidence-card" aria-label="Overall extraction confidence">
        <div>
          <span>Overall extraction confidence</span>
          <div className="confidence-track"><span style={{ width: confidence }}></span></div>
          <small>{confidence} - {quote.insured.name ?? sourceFile ?? quote.quoteId}</small>
        </div>
        <strong>{confidence}<small>confidence</small></strong>
      </section>

      <DataPointSection title="Insured">
        <dl className="data-point-list">
          <DataPointRow label="Name" value={property?.insured?.name ?? quote.insured.name} evidence={getEvidence(dataQuality, "insured.name")} />
          <DataPointRow label="Trade / industry" value={quote.insured.trade} />
          <DataPointRow label="Industry code" value={property?.insured?.industryCode} />
          <DataPointRow
            label="Revenue / turnover"
            value={formatCurrency(property?.insured?.revenueOrTurnover ?? quote.insured.turnover)}
            evidence={getEvidence(dataQuality, "insured.turnover")}
          />
          <DataPointRow label="Employees" value={property?.insured?.employees} />
          <DataPointRow label="Operations / locations" value={property?.insured?.operationsOrLocations} />
          <DataPointRow label="Address" value={quote.insured.address} missing={!quote.insured.address} />
        </dl>
      </DataPointSection>

      <DataPointSection title="Broker">
        <dl className="data-point-list">
          <DataPointRow label="Firm name" value={property?.broker?.name ?? quote.broker?.name} evidence={getEvidence(dataQuality, "broker.name")} />
          <DataPointRow label="Contact" value={property?.broker?.contact ?? quote.broker?.contact} />
          <DataPointRow label="Email" value={property?.broker?.email} />
          <DataPointRow label="Phone" value={property?.broker?.phone} />
          <DataPointRow label="Submission reference" value={property?.broker?.submissionReference} />
          <DataPointRow label="Proposed effective date" value={property?.broker?.proposedEffectiveDate ?? quote.risk.inceptionDate} />
          <DataPointRow label="Market deadline" value={property?.broker?.marketDeadline} />
        </dl>
      </DataPointSection>

      {property ? (
        <>
          <DataPointSection title="Coverage Requested">
            <dl className="data-point-list">
              <DataPointRow label="Buildings & landlord contents" value={formatCurrency(property.coverage.buildingsAndLandlordContents)} evidence={getEvidence(dataQuality, "coverage.buildingsAndLandlordContents")} />
              <DataPointRow label="Loss of rent" value={property.coverage.lossOfRentMonths ? `${property.coverage.lossOfRentMonths} months` : undefined} />
              <DataPointRow label="Property owners liability" value={formatCurrency(property.coverage.propertyOwnersLiability)} evidence={getEvidence(dataQuality, "coverage.propertyOwnersLiability")} />
              <DataPointRow label="Terrorism" value={formatBoolean(property.coverage.terrorismIncluded)} />
              <DataPointRow label="Engineering inspection & breakdown" value={formatBoolean(property.coverage.engineeringInspectionAndBreakdownRequested, "Requested", "Not requested")} />
            </dl>
          </DataPointSection>

          <DataPointSection title={`Location Schedule (${property.locations.length} entries)`}>
            <div className="table-wrap data-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Construction</th>
                    <th>Built</th>
                    <th>Stories</th>
                    <th>TIV</th>
                    <th>Occupancy / notes</th>
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
                      <td>{[location.occupancy, location.notes].filter(Boolean).join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {getEvidence(dataQuality, "locations")?.evidence && <p className="table-note">{getEvidence(dataQuality, "locations")?.evidence}</p>}
          </DataPointSection>

          <DataPointSection title={`Loss History (${property.lossHistory.length} entries)`}>
            <div className="table-wrap data-table-wrap">
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
            {getEvidence(dataQuality, "lossHistory")?.evidence && <p className="table-note">{getEvidence(dataQuality, "lossHistory")?.evidence}</p>}
          </DataPointSection>

          <DataPointSection title="Underwriting Data">
            <dl className="data-point-list">
              <DataPointRow label="Requested common renewal" value={property.underwriting?.requestedCommonRenewalDate} />
              <DataPointRow label="EoW deductible cap" value={formatCurrency(property.underwriting?.escapeOfWaterDeductibleCap)} />
              <DataPointRow label="Marketing basis" value={property.underwriting?.accountMarketingBasis} />
              <DataPointRow label="Broker instructions" value={property.underwriting?.brokerInstructions} />
            </dl>
          </DataPointSection>

          {!!property.attachments?.length && (
            <DataPointSection title={`Attachments (${property.attachments.length} listed)`}>
              <div className="table-wrap data-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Status</th>
                      <th>Potential issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {property.attachments.map((attachment) => (
                      <tr key={attachment.name}>
                        <td>{attachment.name}</td>
                        <td>{attachment.status ?? "Missing"}</td>
                        <td>{attachment.potentialIssue ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataPointSection>
          )}
        </>
      ) : (
        <DataPointSection title="Coverage Requested">
          <div className="pill-list">
            {quote.risk.coversRequested.map((cover) => <span className="pill" key={cover}>{cover}</span>)}
          </div>
        </DataPointSection>
      )}

      <DataPointSection title={`Missing Fields (${dataQuality.missingFields.length})`}>
        {dataQuality.missingFields.length ? (
          <ul className="issue-list missing-list">{dataQuality.missingFields.map((field) => <li key={field}>{field}</li>)}</ul>
        ) : (
          <p className="muted">No missing fields recorded.</p>
        )}
      </DataPointSection>

      <DataPointSection title={`Warnings (${dataQuality.warnings.length})`}>
        {dataQuality.warnings.length ? (
          <ul className="issue-list warning-list">{dataQuality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        ) : (
          <p className="muted">No warnings recorded.</p>
        )}
      </DataPointSection>
    </main>
  );
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
  const { quote, quoteList, view, setView, error, isConnecting, loadQuote, loadQuoteList, updateStatus, updateQuote } = useQuote();
  const [reviewWorkflowState, setReviewWorkflowState] = React.useState<"idle" | "processing" | "complete">("idle");

  if (error) return <main className="shell error"><h1>Unable to load quote</h1><p>{error}</p></main>;
  if (quoteList) return <QuoteBrowser quotes={quoteList} onSelect={loadQuote} onFilter={loadQuoteList} />;
  if (!quote) return <main className="shell"><h1>{isConnecting ? "Connecting quote app..." : "Loading quote record..."}</h1></main>;
  if (view === "data_points") return <DataPointsView quote={quote} onViewChange={setView} />;
  if (view === "graph") return <EntityGraphView quote={quote} onViewChange={setView} />;

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
        <div className="hero-actions">
          <div className="view-actions" role="group" aria-label="Quote view">
            <button className="active" type="button" onClick={() => setView("record")}>Record</button>
            <button type="button" onClick={() => setView("data_points")}>Data Points</button>
            <button type="button" onClick={() => setView("graph")}><GitBranch size={14} /> Graph</button>
          </div>
          <span className={`status ${quote.status.toLowerCase().replaceAll(" ", "-")}`}>{quote.status}</span>
        </div>
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
