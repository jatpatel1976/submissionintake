import { z } from "zod";

export const ProductTypeSchema = z.enum(["generic_commercial", "property_owners"]);

export const ExtractionEvidenceSchema = z.object({
  field: z.string(),
  label: z.string().optional(),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1)
});

export const DataQualitySchema = z.object({
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.array(ExtractionEvidenceSchema).optional()
});

export const InsuredSchema = z.object({
  name: z.string().optional(),
  trade: z.string().optional(),
  address: z.string().optional(),
  turnover: z.number().optional()
});

export const BrokerSchema = z.object({
  name: z.string().optional(),
  contact: z.string().optional()
});

export const RiskSchema = z.object({
  classOfBusiness: z.string().optional(),
  inceptionDate: z.string().optional(),
  coversRequested: z.array(z.string())
});

export const AttachmentSchema = z.object({
  name: z.string(),
  status: z.string().optional(),
  potentialIssue: z.string().optional()
});

export const LossHistorySchema = z.object({
  date: z.string().optional(),
  type: z.string().optional(),
  paid: z.number().optional(),
  reserved: z.number().optional(),
  description: z.string().optional()
});

export type ProductType = z.infer<typeof ProductTypeSchema>;
export type DataQuality = z.infer<typeof DataQualitySchema>;
export type Insured = z.infer<typeof InsuredSchema>;
export type Broker = z.infer<typeof BrokerSchema>;
export type Risk = z.infer<typeof RiskSchema>;
