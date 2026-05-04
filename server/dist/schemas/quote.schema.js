import { z } from "zod";
export const SubmissionSchema = z.object({
    sourceFile: z.string().optional(),
    insured: z.object({
        name: z.string().optional(),
        trade: z.string().optional(),
        address: z.string().optional(),
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
    }),
    dataQuality: z.object({
        missingFields: z.array(z.string()),
        warnings: z.array(z.string()),
        confidence: z.number().min(0).max(1)
    })
});
export const QuoteSchema = z.object({
    quoteId: z.string(),
    status: z.enum(["Draft", "In Review", "Quoted", "Declined"]),
    createdAt: z.string(),
    insured: SubmissionSchema.shape.insured,
    broker: SubmissionSchema.shape.broker.optional(),
    risk: SubmissionSchema.shape.risk,
    dataQuality: SubmissionSchema.shape.dataQuality
});
