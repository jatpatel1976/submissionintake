import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { DataQuality, PropertyOwnersProductData } from "../../types";
import { formatBoolean, formatCurrency } from "../../utils/formatting";
import { getEvidence } from "../../utils/quote";
import { DataPointRow } from "./DataPoint";

type LocationSchedulePanelProps = {
  property: PropertyOwnersProductData;
  dataQuality: DataQuality;
  selectedLocationIndex?: number | null;
  onSelectLocation?: (index: number) => void;
};

export type ExpandableTableRowProps = {
  cells: ReactNode[];
  colSpan: number;
  detail: ReactNode;
  detailId: string;
  expandLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
};

export function ExpandableTableRow({ cells, colSpan, detail, detailId, expandLabel, isExpanded, onToggle, className }: ExpandableTableRowProps) {
  const [primaryCell, ...remainingCells] = cells;

  return (
    <>
      <tr className={className}>
        <td>
          <div className="expandable-row-primary">
            {primaryCell}
            <button
              className="expandable-row-toggle"
              type="button"
              aria-expanded={isExpanded}
              aria-controls={detailId}
              onClick={onToggle}
            >
              <ChevronDown className={isExpanded ? "is-open" : ""} size={14} />
              {expandLabel}
            </button>
          </div>
        </td>
        {remainingCells.map((cell, index) => <td key={index}>{cell}</td>)}
      </tr>
      {isExpanded && (
        <tr className="expandable-detail-row">
          <td colSpan={colSpan} id={detailId}>{detail}</td>
        </tr>
      )}
    </>
  );
}

export function LocationSchedulePanel({ property, dataQuality, selectedLocationIndex, onSelectLocation }: LocationSchedulePanelProps) {
  const [expandedLocationKey, setExpandedLocationKey] = useState<string | null>(null);

  function toggleLocationDetail(locationKey: string) {
    setExpandedLocationKey((currentKey) => currentKey === locationKey ? null : locationKey);
  }

  return (
    <>
      <div className="table-wrap data-table-wrap location-schedule-wrap">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Construction</th>
              <th>Built</th>
              <th>Stories</th>
              <th>TIV</th>
            </tr>
          </thead>
          <tbody>
            {property.locations.map((location, index) => {
              const isSelected = selectedLocationIndex === index;
              const locationKey = `${location.name}-${index}`;
              const detailId = `location-detail-${index}`;
              const isExpanded = expandedLocationKey === locationKey;
              return (
                <ExpandableTableRow
                  className={isSelected ? "is-selected-row" : ""}
                  colSpan={5}
                  detailId={detailId}
                  expandLabel={isExpanded ? "Hide details" : "Show details"}
                  isExpanded={isExpanded}
                  key={locationKey}
                  onToggle={() => toggleLocationDetail(locationKey)}
                  cells={[
                    onSelectLocation ? (
                      <button className="table-row-button" type="button" onClick={() => onSelectLocation(index)}>
                        {location.name}
                      </button>
                    ) : location.name,
                    location.construction ?? "Missing",
                    location.yearBuilt ?? "Missing",
                    location.stories ?? "Missing",
                    formatCurrency(location.tiv)
                  ]}
                  detail={(
                    <dl className="expandable-row-detail-list">
                      <dt>Occupancy</dt><dd>{location.occupancy ?? "Missing"}</dd>
                      <dt>Notes</dt><dd>{location.notes ?? "Missing"}</dd>
                    </dl>
                  )}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {getEvidence(dataQuality, "locations")?.evidence && <p className="table-note">{getEvidence(dataQuality, "locations")?.evidence}</p>}
    </>
  );
}

export function PropertyCoverageDetails({ property, dataQuality, mode = "definition" }: { property: PropertyOwnersProductData; dataQuality?: DataQuality; mode?: "definition" | "dataPoints" }) {
  if (mode === "dataPoints") {
    return (
      <dl className="data-point-list">
        <DataPointRow label="Buildings & landlord contents" value={formatCurrency(property.coverage.buildingsAndLandlordContents)} evidence={dataQuality ? getEvidence(dataQuality, "coverage.buildingsAndLandlordContents") : undefined} />
        <DataPointRow label="Loss of rent" value={property.coverage.lossOfRentMonths ? `${property.coverage.lossOfRentMonths} months` : undefined} />
        <DataPointRow label="Property owners liability" value={formatCurrency(property.coverage.propertyOwnersLiability)} evidence={dataQuality ? getEvidence(dataQuality, "coverage.propertyOwnersLiability") : undefined} />
        <DataPointRow label="Terrorism" value={formatBoolean(property.coverage.terrorismIncluded)} />
        <DataPointRow label="Engineering inspection & breakdown" value={formatBoolean(property.coverage.engineeringInspectionAndBreakdownRequested, "Requested", "Not requested")} />
      </dl>
    );
  }

  return (
    <dl>
      <dt>Buildings & Contents</dt><dd>{formatCurrency(property.coverage.buildingsAndLandlordContents)}</dd>
      <dt>Loss of Rent</dt><dd>{property.coverage.lossOfRentMonths ? `${property.coverage.lossOfRentMonths} months` : "Missing"}</dd>
      <dt>Owners Liability</dt><dd>{formatCurrency(property.coverage.propertyOwnersLiability)}</dd>
      <dt>Terrorism</dt><dd>{formatBoolean(property.coverage.terrorismIncluded)}</dd>
      <dt>Engineering</dt><dd>{formatBoolean(property.coverage.engineeringInspectionAndBreakdownRequested, "Requested", "Not requested")}</dd>
    </dl>
  );
}

export function LossHistoryPanel({ property, dataQuality }: { property: PropertyOwnersProductData; dataQuality?: DataQuality }) {
  const [expandedLossKey, setExpandedLossKey] = useState<string | null>(null);

  function toggleLossDetail(lossKey: string) {
    setExpandedLossKey((currentKey) => currentKey === lossKey ? null : lossKey);
  }

  return (
    <>
      <div className="table-wrap data-table-wrap loss-history-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Paid</th>
              <th>Reserved</th>
            </tr>
          </thead>
          <tbody>
            {property.lossHistory.map((loss, index) => {
              const lossKey = `${loss.date ?? "loss"}-${index}`;
              const detailId = `loss-detail-${index}`;
              const isExpanded = expandedLossKey === lossKey;

              return (
                <ExpandableTableRow
                  colSpan={4}
                  detailId={detailId}
                  expandLabel={isExpanded ? "Hide description" : "Show description"}
                  isExpanded={isExpanded}
                  key={lossKey}
                  onToggle={() => toggleLossDetail(lossKey)}
                  cells={[
                    loss.date ?? "Missing",
                    loss.type ?? "Missing",
                    formatCurrency(loss.paid),
                    formatCurrency(loss.reserved)
                  ]}
                  detail={(
                    <dl className="expandable-row-detail-list">
                      <dt>Description</dt><dd>{loss.description ?? "Missing"}</dd>
                    </dl>
                  )}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {dataQuality && getEvidence(dataQuality, "lossHistory")?.evidence && <p className="table-note">{getEvidence(dataQuality, "lossHistory")?.evidence}</p>}
    </>
  );
}

export function AttachmentsPanel({ property }: { property: PropertyOwnersProductData }) {
  if (!property.attachments?.length) return <p className="muted">No attachments listed.</p>;

  return (
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
  );
}

export function DataQualityDetails({ dataQuality }: { dataQuality: DataQuality }) {
  return (
    <div className="data-quality-details">
      <h3>Missing</h3>
      {dataQuality.missingFields.length ? (
        <ul className="issue-list missing-list">{dataQuality.missingFields.map((field) => <li key={field}>{field}</li>)}</ul>
      ) : (
        <p className="muted">No missing fields recorded.</p>
      )}
      <h3>Warnings</h3>
      {dataQuality.warnings.length ? (
        <ul className="issue-list warning-list">{dataQuality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      ) : (
        <p className="muted">No warnings recorded.</p>
      )}
    </div>
  );
}
