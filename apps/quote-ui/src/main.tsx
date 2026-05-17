import React from "react";
import ReactDOM from "react-dom/client";
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
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, GitBranch, Minus, Pencil, Plus, RotateCcw, Save, Send, ShieldCheck, X } from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import { useQuote } from "./api/useQuote";
import { QuoteBrowser } from "./components/browser/QuoteBrowser";
import { DataPointsView } from "./components/data-points/DataPointsView";
import { buildQuoteGraph, type EntityEdge, type EntityNode, type GraphCenter, type GraphGroup, type PositionedEntityNode } from "./components/graph/buildQuoteGraph";
import { AttachmentsPanel, DataQualityDetails, LocationSchedulePanel, LossHistoryPanel, PropertyCoverageDetails } from "./components/shared/PropertyDetails";
import type { Quote, ViewMode } from "./types";
import { formatCurrency, formatPercent } from "./utils/formatting";
import { getPropertyData } from "./utils/quote";

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
  const dataQuality = quote.productSubmission?.dataQuality ?? quote.dataQuality;
  const [isLocationScheduleOpen, setIsLocationScheduleOpen] = React.useState(false);
  if (!property) return null;

  return (
    <>
      <article className="card property-summary">
        <h2>Property Coverage</h2>
        <PropertyCoverageDetails property={property} />
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
          <LocationSchedulePanel property={property} dataQuality={dataQuality} />
        )}
      </article>

      <article className="card table-card">
        <h2>Loss History</h2>
        <LossHistoryPanel property={property} dataQuality={dataQuality} />
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

type NodePosition = { x: number; y: number };

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
  const property = getPropertyData(quote);
  const dataQuality = quote.productSubmission?.dataQuality ?? quote.dataQuality;
  const graphCanvasRef = React.useRef<HTMLDivElement | null>(null);
  const detailPanelRef = React.useRef<HTMLElement | null>(null);
  const shouldFocusDetailRef = React.useRef(false);
  const [center, setCenter] = React.useState<GraphCenter>("risk");
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>("risk");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<GraphGroup>>(() => new Set());
  const [focusedGroup, setFocusedGroup] = React.useState<GraphGroup | null>(null);
  const [focusedLocationIndex, setFocusedLocationIndex] = React.useState<number | null>(null);
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
  const selectedLocationMatch = selectedNodeId.match(/^location-(\d+)$/);
  const selectedLocationIndex = focusedLocationIndex ?? (selectedLocationMatch ? Number(selectedLocationMatch[1]) : null);
  const selectedLocation = selectedLocationIndex !== null && property?.locations[selectedLocationIndex]
    ? property.locations[selectedLocationIndex]
    : null;

  React.useEffect(() => {
    if (!graph.nodesById.has(selectedNodeId)) {
      setSelectedNodeId(graph.nodes[0]?.id ?? "insured");
    }
  }, [graph.nodes, graph.nodesById, selectedNodeId]);

  React.useEffect(() => {
    setFlowNodes(graph.nodes.map((node) => entityToFlowNode(node, center, nodePositions[node.id])));
  }, [center, graph.nodes, nodePositions]);

  React.useEffect(() => {
    if (!focusedGroup || !shouldFocusDetailRef.current) return;
    shouldFocusDetailRef.current = false;
    window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      detailPanelRef.current?.focus({ preventScroll: true });
    });
  }, [focusedGroup]);

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
    setFocusedGroup(null);
    setFocusedLocationIndex(null);
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

  function selectNode(node: EntityFlowNode) {
    setSelectedNodeId(node.id);
    if (node.data.groupKey || node.id.startsWith("location-")) {
      shouldFocusDetailRef.current = true;
      setFocusedGroup(node.data.groupKey ?? "locations");
      setFocusedLocationIndex(null);
      if (node.id.startsWith("location-")) setFocusedLocationIndex(Number(node.id.replace("location-", "")));
      return;
    }
    setFocusedGroup(null);
    setFocusedLocationIndex(null);
  }

  function selectLocation(index: number) {
    const locationNodeId = `location-${index}`;
    if (graph.nodesById.has(locationNodeId)) setSelectedNodeId(locationNodeId);
    else setSelectedNodeId("locations");
    setFocusedGroup("locations");
    setFocusedLocationIndex(index);
  }

  function clearFocus() {
    setFocusedGroup(null);
    setFocusedLocationIndex(null);
    setSelectedNodeId(center);
    window.requestAnimationFrame(() => {
      graphCanvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      graphCanvasRef.current?.focus({ preventScroll: true });
    });
  }

  function focusedPanelTitle() {
    if (focusedGroup === "locations" && property) return `${property.locations.length} locations`;
    if (focusedGroup === "coverage") return "Coverage requested";
    if (focusedGroup === "lossHistory" && property) return `${property.lossHistory.length} loss history entries`;
    if (focusedGroup === "attachments" && property) return `${property.attachments?.length ?? 0} attachments`;
    if (focusedGroup === "quality") return "Data quality";
    return selectedNode.label;
  }

  function renderFocusedPanelContent() {
    if (!focusedGroup) return null;
    if (focusedGroup === "coverage") {
      return property
        ? <PropertyCoverageDetails property={property} dataQuality={dataQuality} mode="dataPoints" />
        : <div className="pill-list">{quote.risk.coversRequested.map((cover) => <span className="pill" key={cover}>{cover}</span>)}</div>;
    }
    if (focusedGroup === "locations" && property) {
      return (
        <>
          {selectedLocation && (
            <dl className="focused-location-summary">
              <dt>Selected</dt><dd>{selectedLocation.name}</dd>
              <dt>TIV</dt><dd>{formatCurrency(selectedLocation.tiv)}</dd>
              <dt>Occupancy</dt><dd>{selectedLocation.occupancy ?? "Missing"}</dd>
            </dl>
          )}
          <LocationSchedulePanel
            property={property}
            dataQuality={dataQuality}
            selectedLocationIndex={selectedLocationIndex}
            onSelectLocation={selectLocation}
          />
        </>
      );
    }
    if (focusedGroup === "lossHistory" && property) return <LossHistoryPanel property={property} dataQuality={dataQuality} />;
    if (focusedGroup === "attachments" && property) return <AttachmentsPanel property={property} />;
    if (focusedGroup === "quality") return <DataQualityDetails dataQuality={dataQuality} />;
    return null;
  }

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
        <div ref={graphCanvasRef} className="entity-graph-canvas" aria-label="Submission entity relationship graph" tabIndex={-1}>
          <ReactFlow<EntityFlowNode, EntityFlowEdge>
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onNodeClick={(_event, node) => selectNode(node)}
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

      {focusedGroup && renderFocusedPanelContent() && (
        <section ref={detailPanelRef} className="entity-focus-panel" tabIndex={-1} aria-live="polite">
          <div className="focus-panel-heading">
            <div>
              <p className="eyebrow">Graph Detail</p>
              <h2>{focusedPanelTitle()}</h2>
              <p className="muted">{selectedLocation ? selectedLocation.name : selectedNode.subtitle ?? "Property portfolio"}</p>
            </div>
            <button className="reset-layout-button" type="button" onClick={clearFocus}><RotateCcw size={14} /> Hide details</button>
          </div>
          {renderFocusedPanelContent()}
        </section>
      )}
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
          <DataQualityDetails dataQuality={quote.dataQuality} />
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
