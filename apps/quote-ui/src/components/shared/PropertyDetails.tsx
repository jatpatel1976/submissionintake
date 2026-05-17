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

export function LocationSchedulePanel({ property, dataQuality, selectedLocationIndex, onSelectLocation }: LocationSchedulePanelProps) {
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
              <th>Occupancy / notes</th>
            </tr>
          </thead>
          <tbody>
            {property.locations.map((location, index) => {
              const isSelected = selectedLocationIndex === index;
              return (
                <tr className={isSelected ? "is-selected-row" : ""} key={location.name}>
                  <td>
                    {onSelectLocation ? (
                      <button className="table-row-button" type="button" onClick={() => onSelectLocation(index)}>
                        {location.name}
                      </button>
                    ) : location.name}
                  </td>
                  <td>{location.construction ?? "Missing"}</td>
                  <td>{location.yearBuilt ?? "Missing"}</td>
                  <td>{location.stories ?? "Missing"}</td>
                  <td>{formatCurrency(location.tiv)}</td>
                  <td>{[location.occupancy, location.notes].filter(Boolean).join("; ")}</td>
                </tr>
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
  return (
    <>
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
