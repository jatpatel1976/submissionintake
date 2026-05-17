import type { DataQuality, DetailViewMode, Quote } from "../../types";
import { formatCurrency } from "../../utils/formatting";
import { getPropertyData } from "../../utils/quote";

export type GraphCenter = "insured" | "risk" | "broker";
export type RagStatus = "red" | "amber" | "green";
export type GraphGroup = "coverage" | "locations" | "lossHistory" | "attachments" | "quality";

export type EntityNode = {
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

export type EntityEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type PositionedEntityNode = EntityNode & {
  x: number;
  y: number;
};

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

export function buildQuoteGraph(quote: Quote, center: GraphCenter, expandedGroups: Set<GraphGroup>): { nodes: PositionedEntityNode[]; edges: EntityEdge[] } {
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
