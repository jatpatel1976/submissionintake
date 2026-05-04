# Submission Intake Skill

Use this playbook to classify broker submission documents and extract either a generic quote shell or product-specific property owners package datapoints.

## Workflow

- Confirm the uploaded document is likely to be a broker submission.
- For PDFs, extract machine-readable text first. If no text can be extracted, request OCR or a text copy before quote creation.
- For generic commercial combined submissions, extract insured, broker, risk and data-quality fields into the quote schema.
- For property owners package submissions, call extract_property_submission and validate against the property owners schema.
- Do not invent insured, broker or inception values when the broker document omits them. Leave omitted values blank and flag them in dataQuality.missingFields.
- Preserve source evidence for extracted fields wherever possible.
- For property submissions, show the location schedule as a table with one row per location.
- For generic submissions, create a draft quote from the extracted submission with create_quote.
- For property owners submissions, create a draft quote with create_quote and pass the extracted property envelope as productSubmission so the location schedule and property-specific datapoints are stored on the quote.
- Render the embedded quote record MCP App for review.
- To browse existing records, call get_quote without quoteId and optionally pass productType. Use quoteId only when retrieving one selected quote.

## Classification Indicators

- insured
- broker
- claims
- turnover
- revenue
- premium
- inception
- public liability
- property damage
- employers liability
- business interruption
- property owners package
- mixed-use portfolio
- landlord contents
- loss of rent
- scheduled premises
- TIV

## Extraction Labels

- insured.name: insured | applicant | client
- insured.trade: trade | business description | occupation
- insured.address: address | premises | location
- insured.turnover: turnover | revenue
- broker.name: broker | intermediary
- broker.contact: contact | broker contact
- risk.inceptionDate: inception date | inception | renewal date

## Property Owners Extraction Labels

- product: property owners package | property owners | mixed-use portfolio
- insured.name: named insured | insured | applicant | client
- insured.industryCode: industry / NAICS | NAICS | SIC | industry
- insured.revenueOrTurnover: revenue / turnover | revenue | turnover | rental income
- insured.employees: employees | employee count | headcount
- insured.operationsOrLocations: operations / locations | operations | locations | premises
- broker.name: broker | intermediary
- broker.contact: contact | broker contact
- broker.email: email | broker email
- broker.phone: phone | telephone
- broker.submissionReference: submission reference | broker reference | submission ref
- broker.proposedEffectiveDate: proposed effective date | effective date | renewal date | inception date
- coverage.buildingsAndLandlordContents: buildings and landlord contents | buildings | landlord contents | declared value
- coverage.lossOfRentMonths: loss of rent | rent receivable | indemnity period
- coverage.propertyOwnersLiability: property owners liability | owners liability | public liability
- coverage.terrorismIncluded: terrorism | terrorism included
- coverage.engineeringInspectionAndBreakdownRequested: engineering inspection | engineering breakdown | breakdown requested
- locations.name: location | premises | risk address | scheduled premises
- locations.construction: construction | construction type
- locations.yearBuilt: year | year built | built
- locations.stories: stories | storeys | floors
- locations.tiv: TIV | total insured value | total insurable value
- locations.occupancy: occupancy | tenant use | usage
- locations.notes: notes | risk notes | comments
- lossHistory.date: date | loss date
- lossHistory.type: type | cause | peril
- lossHistory.paid: paid | paid amount
- lossHistory.reserved: reserved | reserve | outstanding
- lossHistory.description: description | loss description
- attachments.name: attachment name | file name
- attachments.status: status | provided | partial
- attachments.potentialIssue: potential intake issue | issue | note
- underwriting.requestedCommonRenewalDate: common renewal date | renewal date
- underwriting.escapeOfWaterDeductibleCap: escape-of-water deductible | escape of water deductible | water deductible
- underwriting.accountMarketingBasis: marketed on | marketing basis
- underwriting.brokerInstructions: broker instructions | instructions to underwriters

## Defaults

- risk.classOfBusiness: Commercial Combined
- dataQuality.confidence: 0.86

## Covers Requested

- Property Damage
- Business Interruption
- Employers Liability
- Public Liability

## Missing Fields

- Claims history
- Construction type
- BI indemnity period

## Property Owners Required Fields

- insured.name
- insured.revenueOrTurnover
- broker.name
- broker.email
- coverage.buildingsAndLandlordContents
- coverage.propertyOwnersLiability
- locations
- lossHistory

## Property Owners Location Table Columns

- Location
- Construction
- Year
- Stories
- TIV
- Occupancy
- Notes

## Property Owners Warnings

- Expired valuation schedules should not override current location schedule values.
- Unresolved cladding or EWS1 wording should be flagged for underwriting review.
- Terrorism requests may need separate tax, pool wording or quote-target handling.
- Mixed currencies, open reserves or duplicate asset identifiers in attachments should be flagged.

## Warnings

- Turnover found but not split by activity
