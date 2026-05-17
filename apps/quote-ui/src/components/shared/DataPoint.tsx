import React from "react";
import { formatPercent } from "../../utils/formatting";

type DataPointRowProps = {
  label: string;
  value?: React.ReactNode;
  evidence?: { evidence?: string; confidence: number };
  missing?: boolean;
};

export function DataPointRow({ label, value, evidence, missing }: DataPointRowProps) {
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

export function DataPointSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="data-point-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
