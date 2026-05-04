import { z } from "zod";
import { PropertyOwnersSubmissionEnvelopeSchema } from "./products/propertyOwners.schema.js";

export const ProductSubmissionEnvelopeSchema = z.discriminatedUnion("productType", [
  PropertyOwnersSubmissionEnvelopeSchema
]);

export type ProductSubmissionEnvelope = z.infer<typeof ProductSubmissionEnvelopeSchema>;
