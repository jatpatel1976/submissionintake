import { z } from "zod";
import { BrokerSchema, DataQualitySchema, InsuredSchema, ProductTypeSchema, RiskSchema } from "./common.schema.js";
import { ProductSubmissionEnvelopeSchema } from "./productSubmission.schema.js";

export const SubmissionSchema = z.object({
  sourceFile: z.string().optional(),
  insured: InsuredSchema,
  broker: BrokerSchema.optional(),
  risk: RiskSchema,
  dataQuality: DataQualitySchema
});

export const QuoteSchema = z.object({
  quoteId: z.string(),
  status: z.enum(["Draft", "In Review", "Quoted", "Declined"]),
  createdAt: z.string(),
  productType: ProductTypeSchema,
  insured: InsuredSchema,
  broker: BrokerSchema.optional(),
  risk: RiskSchema,
  dataQuality: DataQualitySchema,
  productSubmission: ProductSubmissionEnvelopeSchema.optional()
});

export type Submission = z.infer<typeof SubmissionSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
