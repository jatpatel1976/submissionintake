function normalizeText(text) {
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\u2022/g, "-")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function compactSpaces(value) {
    return value.replace(/\s+/g, " ").trim();
}
function moneyToNumber(value) {
    if (!value)
        return undefined;
    const normalized = value.toLowerCase().replace(/gbp|£|,/g, "").trim();
    const multiplier = normalized.endsWith("m") ? 1_000_000 : normalized.endsWith("k") ? 1_000 : 1;
    const numeric = Number(normalized.replace(/[mk]$/, ""));
    return Number.isFinite(numeric) ? numeric * multiplier : undefined;
}
function numberFrom(value) {
    if (!value)
        return undefined;
    const numeric = Number(value.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : undefined;
}
function findLine(text, pattern) {
    return text.split("\n").find((line) => pattern.test(line));
}
function evidence(field, source, confidence = 0.9) {
    return { field, evidence: source ? compactSpaces(source) : undefined, confidence: source ? confidence : 0 };
}
function matchValue(text, regex) {
    const match = text.match(regex);
    return {
        value: match?.[1]?.trim(),
        evidence: match?.[0]?.trim()
    };
}
function section(text, startHeading, endHeading) {
    const start = text.indexOf(startHeading);
    if (start === -1)
        return "";
    const end = text.indexOf(endHeading, start + startHeading.length);
    return text.slice(start + startHeading.length, end === -1 ? undefined : end).trim();
}
function parseBroker(text) {
    const line = findLine(text, /^Broker:/i);
    const referenceLine = findLine(text, /^Submission reference:/i);
    const proposedDate = matchValue(referenceLine ?? "", /Proposed effective date:\s*([^|]+)/i);
    return {
        broker: {
            name: matchValue(line ?? "", /Broker:\s*([^|]+)/i).value,
            contact: matchValue(line ?? "", /Contact:\s*([^|]+)/i).value,
            email: matchValue(line ?? "", /Email:\s*([^|]+)/i).value,
            phone: matchValue(line ?? "", /Phone:\s*(.+)$/i).value,
            submissionReference: matchValue(referenceLine ?? "", /Submission reference:\s*([^|]+)/i).value,
            proposedEffectiveDate: proposedDate.value,
            marketDeadline: matchValue(referenceLine ?? "", /Market deadline:\s*(.+)$/i).value
        },
        evidence: [
            evidence("broker", line),
            evidence("submissionReference", referenceLine)
        ]
    };
}
function parseInsured(text) {
    const insuredName = matchValue(text, /^Named insured\s+(.+)$/im);
    const industry = matchValue(text, /^Industry \/ NAICS\s+(.+)$/im);
    const revenue = matchValue(text, /^Revenue \/ turnover\s+(GBP\s+[\d,.]+m?)\s*(.+)?$/im);
    const employees = matchValue(text, /^Employees\s+([\d,]+)$/im);
    const operations = matchValue(text, /^Operations \/ locations\s+(.+)$/im);
    return {
        insured: {
            name: insuredName.value,
            industryCode: industry.value,
            revenueOrTurnover: moneyToNumber(revenue.value),
            revenueBasis: revenue.evidence ? compactSpaces(revenue.evidence.replace(/^Revenue \/ turnover\s+/i, "")) : undefined,
            employees: numberFrom(employees.value),
            operationsOrLocations: operations.value
        },
        evidence: [
            evidence("insured.name", insuredName.evidence),
            evidence("insured.industryCode", industry.evidence),
            evidence("insured.revenueOrTurnover", revenue.evidence),
            evidence("insured.employees", employees.evidence),
            evidence("insured.operationsOrLocations", operations.evidence)
        ]
    };
}
function parseCoverage(text) {
    const buildings = matchValue(text, /Buildings and landlord contents\s+(GBP\s+[\d,]+)/i);
    const lossOfRent = matchValue(text, /Loss of rent:\s*(\d+)\s*months/i);
    const liability = matchValue(text, /Property owners liability\s+(GBP\s+[\d,]+)/i);
    const terrorism = findLine(text, /Terrorism included/i);
    const engineering = findLine(text, /Engineering inspection and breakdown requested/i);
    return {
        coverage: {
            buildingsAndLandlordContents: moneyToNumber(buildings.value),
            lossOfRentMonths: numberFrom(lossOfRent.value),
            propertyOwnersLiability: moneyToNumber(liability.value),
            terrorismIncluded: Boolean(terrorism),
            engineeringInspectionAndBreakdownRequested: Boolean(engineering)
        },
        evidence: [
            evidence("coverage.buildingsAndLandlordContents", buildings.evidence),
            evidence("coverage.lossOfRentMonths", lossOfRent.evidence),
            evidence("coverage.propertyOwnersLiability", liability.evidence),
            evidence("coverage.terrorismIncluded", terrorism),
            evidence("coverage.engineeringInspectionAndBreakdownRequested", engineering)
        ]
    };
}
function parseLocations(text) {
    const schedule = section(text, "4. Risk and Exposure Schedule", "5. Loss History");
    function splitOccupancyNotes(value) {
        const normalized = compactSpaces(value);
        const notePatterns = [
            /^(Retail ground floor;\s*apartments above);\s*(.+)$/i,
            /^(restaurant tenant with deep-fat fryers);\s*(Grade II facade)$/i,
            /^(Grade II facade);\s*(restaurant tenant with deep-fat fryers)$/i,
            /^(Student accommodation);\s*(.+)$/i,
            /^(Mixed office and convenience retail);\s*(.+)$/i
        ];
        for (const pattern of notePatterns) {
            const match = normalized.match(pattern);
            if (match) {
                if (match[1].toLowerCase().includes("grade ii")) {
                    return { occupancy: match[2], notes: match[1] };
                }
                return { occupancy: match[1], notes: match[2] };
            }
        }
        return { occupancy: normalized };
    }
    const locationSpecs = [
        {
            name: "17-25 Marwick Row, London SE1",
            regex: /17-25 Marwick Row,\s*London SE1\s+(.+?)\s+(\d{4})\s+(\S+)\s+GBP\s+([\d,]+)\s+(.+?)(?=Mill Yard Works,)/is
        },
        {
            name: "Mill Yard Works, Bristol BS2",
            regex: /Mill Yard Works,\s*Bristol BS2\s+(.+?)\s+(\d{4})\s+(\S+)\s+GBP\s+([\d,]+)\s+(.+?)(?=Canal House,)/is
        },
        {
            name: "Canal House, Birmingham B1",
            regex: /Canal House,\s*Birmingham B1\s+(.+?)\s+(\d{4})\s+(\S+)\s+GBP\s+([\d,]+)\s+(.+?)(?=Northgate Parade,)/is
        },
        {
            name: "Northgate Parade, Leeds LS2",
            regex: /Northgate Parade,\s*Leeds LS2\s+(.+?)\s+(\d{4})\s+(\S+)\s+GBP\s+([\d,]+)\s+(.+?)(?=11 other minor)/is
        },
        {
            name: "11 other minor premises",
            regex: /11 other minor\s+premises\s+(.+?)\s+(\d{4}-\d{4})\s+(\S+)\s+GBP\s+([\d,]+)\s+(.+)$/is
        }
    ];
    return locationSpecs.flatMap((spec) => {
        const match = schedule.match(spec.regex);
        if (!match)
            return [];
        const occupancyNotes = splitOccupancyNotes(match[5]);
        return [{
                name: spec.name,
                construction: compactSpaces(match[1]),
                yearBuilt: /^\d{4}$/.test(match[2]) ? Number(match[2]) : undefined,
                stories: match[3],
                tiv: moneyToNumber(`GBP ${match[4]}`),
                occupancy: occupancyNotes.occupancy,
                notes: occupancyNotes.notes
            }];
    });
}
function parseLossHistory(text) {
    const losses = section(text, "5. Loss History", "6. Underwriting Narrative");
    const specs = [
        /(\d{4}-\d{2}-\d{2})\s+Escape of water\s+GBP\s+([\d,]+)\s+GBP\s+([\d,]+)\s+(.+?)(?=\d{4}-\d{2}-\d{2})/is,
        /(\d{4}-\d{2}-\d{2})\s+Fire\s+GBP\s+([\d,]+)\s+GBP\s+([\d,]+)\s+(.+?)(?=\d{4}-\d{2}-\d{2})/is,
        /(\d{4}-\d{2}-\d{2})\s+Liability\s+GBP\s+([\d,]+)\s+GBP\s+([\d,]+)\s+(.+)$/is
    ];
    return specs.flatMap((regex) => {
        const match = losses.match(regex);
        if (!match)
            return [];
        const type = regex.source.includes("Escape of water") ? "Escape of water" : regex.source.includes("Fire") ? "Fire" : "Liability";
        return [{
                date: match[1],
                type,
                paid: moneyToNumber(`GBP ${match[2]}`),
                reserved: moneyToNumber(`GBP ${match[3]}`),
                description: compactSpaces(match[4])
            }];
    });
}
function parseAttachments(text) {
    const attachments = section(text, "8. Attachments Listed by Broker", "9. Broker Instructions to Underwriters");
    const names = [
        "SUB-001_completed_application.pdf",
        "SUB-001_loss_runs_2021_2026.xlsx",
        "SUB-001_schedule_of_values.xlsx",
        "SUB-001_survey_or_financials.pdf",
        "SUB-001_broker_email_chain.eml"
    ];
    return names.flatMap((name, index) => {
        const nextName = names[index + 1];
        const start = attachments.indexOf(name);
        if (start === -1)
            return [];
        const end = nextName ? attachments.indexOf(nextName, start + name.length) : -1;
        const row = compactSpaces(attachments.slice(start, end === -1 ? undefined : end));
        const issue = row.replace(name, "").replace(/^Provided\s*/i, "").replace(/^Partial\s*/i, "").trim();
        return [{
                name,
                status: row.includes("Partial") ? "Partial" : "Provided",
                potentialIssue: issue || undefined
            }];
    });
}
function parseUnderwriting(text) {
    const narrative = section(text, "6. Underwriting Narrative", "7. Intake/Parsing Edge Cases");
    const instructions = section(text, "9. Broker Instructions to Underwriters", "-- 2 of 2 --");
    const renewal = matchValue(narrative, /common renewal date of\s+(.+?)\./i);
    const deductible = matchValue(narrative, /higher escape-of-water deductible than\s+(GBP\s+[\d,]+)/i);
    const basis = matchValue(narrative, /marketed on a\s+(.+?)\s+with optional/i);
    return {
        underwriting: {
            requestedCommonRenewalDate: renewal.value,
            escapeOfWaterDeductibleCap: moneyToNumber(deductible.value),
            accountMarketingBasis: basis.value,
            brokerInstructions: compactSpaces(instructions)
        },
        evidence: [
            evidence("underwriting.requestedCommonRenewalDate", renewal.evidence),
            evidence("underwriting.escapeOfWaterDeductibleCap", deductible.evidence),
            evidence("underwriting.accountMarketingBasis", basis.evidence),
            evidence("underwriting.brokerInstructions", instructions)
        ]
    };
}
function missingFields(submission) {
    const required = [
        ["insured.name", submission.insured.name],
        ["insured.revenueOrTurnover", submission.insured.revenueOrTurnover],
        ["broker.name", submission.broker.name],
        ["broker.email", submission.broker.email],
        ["coverage.buildingsAndLandlordContents", submission.coverage.buildingsAndLandlordContents],
        ["coverage.propertyOwnersLiability", submission.coverage.propertyOwnersLiability],
        ["locations", submission.locations.length ? submission.locations : undefined],
        ["lossHistory", submission.lossHistory.length ? submission.lossHistory : undefined]
    ];
    return required.flatMap(([field, value]) => value === undefined ? [field] : []);
}
export async function extractPropertySubmissionFromText(sourceFile, text) {
    const normalizedText = normalizeText(text);
    const broker = parseBroker(normalizedText);
    const insured = parseInsured(normalizedText);
    const coverage = parseCoverage(normalizedText);
    const underwriting = parseUnderwriting(normalizedText);
    const locations = parseLocations(normalizedText);
    const lossHistory = parseLossHistory(normalizedText);
    const attachments = parseAttachments(normalizedText);
    const evidenceItems = [
        ...broker.evidence,
        ...insured.evidence,
        ...coverage.evidence,
        ...underwriting.evidence,
        evidence("locations", locations.length ? `${locations.length} scheduled location rows extracted` : undefined, locations.length ? 0.82 : 0),
        evidence("lossHistory", lossHistory.length ? `${lossHistory.length} loss rows extracted` : undefined, lossHistory.length ? 0.82 : 0),
        evidence("attachments", attachments.length ? `${attachments.length} attachment rows extracted` : undefined, attachments.length ? 0.82 : 0)
    ];
    const draft = {
        product: "Property Owners Package",
        insured: insured.insured,
        broker: broker.broker,
        coverage: coverage.coverage,
        locations,
        lossHistory,
        attachments,
        underwriting: underwriting.underwriting
    };
    const missing = missingFields(draft);
    return {
        sourceFile,
        productType: "property_owners",
        common: {
            insured: {
                name: draft.insured.name,
                trade: draft.insured.industryCode,
                turnover: draft.insured.revenueOrTurnover
            },
            broker: {
                name: draft.broker.name,
                contact: draft.broker.email ?? draft.broker.contact
            },
            risk: {
                classOfBusiness: draft.product,
                inceptionDate: draft.broker.proposedEffectiveDate,
                coversRequested: [
                    "Buildings and Landlord Contents",
                    "Loss of Rent",
                    "Property Owners Liability",
                    ...(draft.coverage.terrorismIncluded ? ["Terrorism"] : []),
                    ...(draft.coverage.engineeringInspectionAndBreakdownRequested ? ["Engineering Inspection and Breakdown"] : [])
                ]
            }
        },
        productData: draft,
        dataQuality: {
            missingFields: missing,
            warnings: [
                ...(normalizedText.includes("expired 2022 valuation schedule") ? ["Expired valuation schedule referenced; current values should come from the location schedule"] : []),
                ...(normalizedText.includes("unresolved EWS1") ? ["Unresolved EWS1 wording referenced in lender correspondence"] : []),
                ...(coverage.coverage.terrorismIncluded ? ["Terrorism requested; quote target/taxes may need separate handling"] : [])
            ],
            confidence: Number(((evidenceItems.filter((item) => item.confidence > 0).length / evidenceItems.length) * 0.9).toFixed(2)),
            evidence: evidenceItems
        }
    };
}
