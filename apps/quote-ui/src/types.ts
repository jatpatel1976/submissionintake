export type DataQuality = {
  missingFields: string[];
  warnings: string[];
  confidence: number;
  evidence?: Array<{ field: string; label?: string; evidence?: string; confidence: number }>;
};

export type Quote = {
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

export type QuoteSummary = {
  quoteId: string;
  status: Quote["status"];
  createdAt: string;
  productType: Quote["productType"];
  underwriterName?: string;
  insuredName?: string;
  brokerName?: string;
  classOfBusiness?: string;
};

export type PropertyOwnersProductData = {
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

export type ToolResult = {
  structuredContent?: unknown;
};

export type ViewMode = "record" | "data_points" | "graph";
export type DetailViewMode = Exclude<ViewMode, "graph">;
