import { z } from "zod";
import { AttachmentSchema, DataQualitySchema, LossHistorySchema } from "../common.schema.js";
export const PropertyOwnersProductDataSchema = z.object({
    product: z.literal("Property Owners Package"),
    insured: z.object({
        name: z.string().optional(),
        industryCode: z.string().optional(),
        revenueOrTurnover: z.number().optional(),
        revenueBasis: z.string().optional(),
        employees: z.number().optional(),
        operationsOrLocations: z.string().optional()
    }),
    broker: z.object({
        name: z.string().optional(),
        contact: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        submissionReference: z.string().optional(),
        proposedEffectiveDate: z.string().optional(),
        marketDeadline: z.string().optional()
    }),
    coverage: z.object({
        buildingsAndLandlordContents: z.number().optional(),
        lossOfRentMonths: z.number().optional(),
        propertyOwnersLiability: z.number().optional(),
        terrorismIncluded: z.boolean().optional(),
        engineeringInspectionAndBreakdownRequested: z.boolean().optional()
    }),
    locations: z.array(z.object({
        name: z.string(),
        construction: z.string().optional(),
        yearBuilt: z.number().optional(),
        stories: z.string().optional(),
        tiv: z.number().optional(),
        occupancy: z.string().optional(),
        notes: z.string().optional()
    })),
    lossHistory: z.array(LossHistorySchema),
    attachments: z.array(AttachmentSchema),
    underwriting: z.object({
        requestedCommonRenewalDate: z.string().optional(),
        escapeOfWaterDeductibleCap: z.number().optional(),
        accountMarketingBasis: z.string().optional(),
        brokerInstructions: z.string().optional()
    })
});
export const PropertyOwnersSubmissionEnvelopeSchema = z.object({
    sourceFile: z.string().optional(),
    productType: z.literal("property_owners"),
    common: z.object({
        insured: z.object({
            name: z.string().optional(),
            trade: z.string().optional(),
            turnover: z.number().optional()
        }),
        broker: z.object({
            name: z.string().optional(),
            contact: z.string().optional()
        }).optional(),
        risk: z.object({
            classOfBusiness: z.string().optional(),
            inceptionDate: z.string().optional(),
            coversRequested: z.array(z.string())
        })
    }),
    productData: PropertyOwnersProductDataSchema,
    dataQuality: DataQualitySchema
});
