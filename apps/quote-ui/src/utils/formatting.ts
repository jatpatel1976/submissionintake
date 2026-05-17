import type { Quote } from "../types";

export function formatCurrency(value?: number) {
  if (value === undefined) return "Missing";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

export function formatProductType(productType: Quote["productType"]) {
  if (productType === "property_owners") return "Property Owners";
  return "Generic Commercial";
}

export function formatPercent(value?: number) {
  if (value === undefined) return "";
  return `${Math.round(value * 100)}%`;
}

export function formatBoolean(value?: boolean, trueText = "Included", falseText = "Not requested") {
  if (value === undefined) return "Missing";
  return value ? trueText : falseText;
}
