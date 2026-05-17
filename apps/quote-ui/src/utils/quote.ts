import type { DataQuality, PropertyOwnersProductData, Quote } from "../types";

export function getPropertyData(quote: Quote): PropertyOwnersProductData | null {
  if (quote.productSubmission?.productType === "property_owners") return quote.productSubmission.productData;
  return null;
}

export function getEvidence(dataQuality: DataQuality, field: string) {
  return dataQuality.evidence?.find((item) => item.field === field);
}
