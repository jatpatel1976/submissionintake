# Submission Intake Skill

Use this playbook to classify broker submission documents and extract the first quote shell for a commercial combined risk.

## Workflow

- Confirm the uploaded document is likely to be a broker submission.
- Extract insured, broker, risk and data-quality fields into the quote schema.
- Create a draft quote from the extracted submission.
- Render the embedded quote record MCP App for review.

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

## Extraction Labels

- insured.name: insured | applicant | client
- insured.trade: trade | business description | occupation
- insured.address: address | premises | location
- insured.turnover: turnover | revenue
- broker.name: broker | intermediary
- broker.contact: contact | broker contact
- risk.inceptionDate: inception date | inception | renewal date

## Defaults

- insured.name: ABC Manufacturing Ltd
- insured.trade: Precision engineering
- insured.address: 1 Industrial Estate, Birmingham
- insured.turnover: 12500000
- broker.name: Example Broker
- risk.classOfBusiness: Commercial Combined
- risk.inceptionDate: 2026-06-01
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

## Warnings

- Turnover found but not split by activity
