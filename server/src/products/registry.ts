import { randomUUID } from "node:crypto";
import { z } from "zod";
import { QuoteSchema } from "../schemas/quote.schema.js";
import { ProductSubmissionEnvelope } from "../schemas/productSubmission.schema.js";
import { PropertyOwnersSubmissionEnvelopeSchema } from "../schemas/products/propertyOwners.schema.js";

type ProductRegistration = {
  schema: z.ZodType;
  mapToQuote: (submission: ProductSubmissionEnvelope) => z.infer<typeof QuoteSchema>;
};

export const productRegistry: Record<ProductSubmissionEnvelope["productType"], ProductRegistration> = {
  property_owners: {
    schema: PropertyOwnersSubmissionEnvelopeSchema,
    mapToQuote: (submission) => QuoteSchema.parse({
      quoteId: `Q-POC-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: "Draft",
      createdAt: new Date().toISOString(),
      productType: submission.productType,
      insured: submission.common.insured,
      broker: submission.common.broker,
      risk: submission.common.risk,
      dataQuality: submission.dataQuality,
      productSubmission: submission
    })
  }
};

export function quoteFromProductSubmission(submission: ProductSubmissionEnvelope): z.infer<typeof QuoteSchema> {
  const registration = productRegistry[submission.productType];
  if (!registration) {
    throw new Error(`Unsupported product type: ${submission.productType}`);
  }

  const parsedSubmission = registration.schema.parse(submission) as ProductSubmissionEnvelope;
  return registration.mapToQuote(parsedSubmission);
}
