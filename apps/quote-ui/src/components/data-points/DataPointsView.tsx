import { GitBranch } from "lucide-react";
import { DataPointRow, DataPointSection } from "../shared/DataPoint";
import { AttachmentsPanel, DataQualityDetails, LocationSchedulePanel, LossHistoryPanel, PropertyCoverageDetails } from "../shared/PropertyDetails";
import type { Quote, ViewMode } from "../../types";
import { formatCurrency, formatPercent } from "../../utils/formatting";
import { getEvidence, getPropertyData } from "../../utils/quote";

export function DataPointsView({ quote, onViewChange }: { quote: Quote; onViewChange: (view: ViewMode) => void }) {
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
            <PropertyCoverageDetails property={property} dataQuality={dataQuality} mode="dataPoints" />
          </DataPointSection>

          <DataPointSection title={`Location Schedule (${property.locations.length} entries)`}>
            <LocationSchedulePanel property={property} dataQuality={dataQuality} />
          </DataPointSection>

          <DataPointSection title={`Loss History (${property.lossHistory.length} entries)`}>
            <LossHistoryPanel property={property} dataQuality={dataQuality} />
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
              <AttachmentsPanel property={property} />
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

      <DataPointSection title={`Data Quality (${dataQuality.missingFields.length} missing, ${dataQuality.warnings.length} warnings)`}>
        <DataQualityDetails dataQuality={dataQuality} />
      </DataPointSection>
    </main>
  );
}
