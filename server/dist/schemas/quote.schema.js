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
export const QuoteStatusSchema = z.enum(["Draft", "In Review", "Quoted", "Declined"]);
const BaseQuoteSchema = z.object({
    quoteId: z.string(),
    status: QuoteStatusSchema,
    createdAt: z.string(),
    insured: InsuredSchema,
    broker: BrokerSchema.optional(),
    risk: RiskSchema,
    dataQuality: DataQualitySchema
});
export const GenericQuoteSchema = BaseQuoteSchema.extend({
    productType: z.literal("generic_commercial")
});
export const ProductQuoteSchema = BaseQuoteSchema.extend({
    productType: z.literal("property_owners"),
    productSubmission: ProductSubmissionEnvelopeSchema
});
export const QuoteSchema = z.discriminatedUnion("productType", [
    GenericQuoteSchema,
    ProductQuoteSchema
]);
export const QuoteSummarySchema = z.object({
    quoteId: z.string(),
    status: QuoteStatusSchema,
    createdAt: z.string(),
    productType: ProductTypeSchema,
    insuredName: z.string().optional(),
    brokerName: z.string().optional(),
    classOfBusiness: z.string().optional()
});
