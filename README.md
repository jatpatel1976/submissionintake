# Submission Intake MCP + Quote Record UI PoC

This repo is a runnable proof of concept for an AI-native insurance submission ingestion capability.

It includes:

- A local MCP server for Claude Desktop
- Tools to classify a document, extract submission data from pasted text or machine-readable PDFs, create a quote, browse quotes and retrieve/update a quote
- A Claude-style dark React/Vite quote record UI embedded inline in Claude as an MCP App iframe, with record, data-points and entity graph views
- A simple underwriting review workflow that updates quote status and allocates an underwriter
- A Markdown submission intake playbook that drives classification indicators, extraction labels, defaults and data quality checks
- A sample broker submission text file you can upload or attach in Claude Desktop

For a visual map of the project and how it maps to MCP Resources, Tools and Prompts, see [docs/mcp-architecture.md](docs/mcp-architecture.md).

## Prerequisites

- macOS
- VS Code
- Node.js 20+
- Claude Desktop

Check Node:

```bash
node -v
npm -v
```

## 1. Open in VS Code

```bash
cd submission-intake-poc
code .
```

## 2. Install dependencies

```bash
npm install
```

## 3. Build the embedded quote UI

Build the React quote UI and MCP server before connecting Claude Desktop:

```bash
npm run build
```

You can still run the UI standalone during local frontend development:

```bash
npm run dev:ui
```

The standalone UI needs the Quote API from the MCP server process. Run both commands in separate terminals for browser-based webview development:

```bash
npm run dev:server
npm run dev:ui
```

Then open:

```text
http://127.0.0.1:5173/
```

To open a specific quote directly in the entity graph view:

```text
http://127.0.0.1:5173/?quoteId=Q-POC-8F16BD57&view=graph
```

You can also use:

```text
view=record
view=data_points
view=graph
```

The graph view is currently implemented as a client-side webview projection of the quote payload. It does not require any quote JSON or server schema changes. The embedded MCP app uses the same built UI bundle, but the `get_quote` MCP tool currently documents `record` and `data_points` as preferred tool-requested views; use the UI's Graph tab after the quote opens in Claude Desktop.

## 4. Run the MCP server locally for testing

In another terminal:

```bash
npm run dev:server
```

This starts:

```text
MCP over stdio
Quote API at http://localhost:8787
```

Press `Ctrl+C` to stop it before letting Claude Desktop run it.

## Viewing Performance Logs

The server writes timing logs to stderr and mirrors them to:

```text
logs/submission-intake.log
```

To watch logs in a bash terminal:

```bash
tail -f logs/submission-intake.log
```

Claude Desktop starts the MCP server as its own child process from `claude_desktop_config.json`. If you separately run `npm run dev:server` in a terminal, Claude Desktop will not send tool calls to that terminal process. Tailing the log file is the most reliable way to see the MCP timing logs regardless of which process launched the server.

You can override the log path with:

```bash
SUBMISSION_INTAKE_LOG_FILE=/tmp/submission-intake.log npm run dev:server
```

## Submission Intake Tests

Run the submission ingestion and output tests with:

```bash
npm run test:submission
```

This reads `samples/sample-submission.txt`, classifies it, extracts structured submission data, validates the output with the Zod schemas, and checks the quote-shaped output produced from the extracted submission.

The test suite also covers product-specific property owners extraction, quote listing/filtering, and the underwriter allocation applied when a quote is sent to review.

## 5. Configure Claude Desktop

Open the Claude Desktop configuration file.

On macOS this is usually:

```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add this configuration, replacing the repo path with your actual repo path:

```json
{
  "mcpServers": {
    "submission-intake": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/submission-intake-poc/server/dist/index.js"],
      "env": {
        "API_PORT": "8787"
      }
    }
  }
}
```

For example, if the repo is stored at `/Users/jatinpatel/Projects/submission-intake-poc`, use:

```json
{
  "mcpServers": {
    "submission-intake": {
      "command": "node",
      "args": [
        "/Users/jatinpatel/Projects/submission-intake-poc/server/dist/index.js"
      ],
      "env": {
        "API_PORT": "8787"
      }
    }
  }
}
```

Do not use `npm run dev` in the Claude Desktop MCP config. npm and Vite print build output to stdout, and MCP over stdio requires stdout to contain only JSON-RPC messages.

Restart Claude Desktop.

## 6. Demo in Claude Desktop

Make sure the embedded quote UI and server have been built:

```bash
npm run build
```

Then in Claude Desktop, ask:

```text
I uploaded a broker submission. Use the submission-intake MCP server to classify the uploaded document.
```

Then ask:

```text
Extract the submission data from the uploaded document.
```

Then ask:

```text
Create a quote shell from the extracted submission and show me the quote record UI.
```

The MCP server also exposes prompts named:

```text
upload_submission
extract_submission
create_quote
get_quote
```

Claude Desktop discovers these prompts during MCP startup, but some Claude Desktop versions do not show local MCP prompts in the chat slash-command menu. If they do appear in your client, they may be shown under the server name:

```text
/submission-intake:upload_submission
/submission-intake:extract_submission
/submission-intake:create_quote
/submission-intake:get_quote
```

If the slash commands are not visible, use the natural-language prompts above instead. Claude Desktop can still call the `classify_document`, `extract_submission`, `create_quote` and `get_quote` MCP tools from the connected server.

Claude should call the MCP tools and render the quote record UI inline in the conversation as an MCP App iframe. The status buttons in the embedded UI call the `update_quote_status` MCP tool.

To mimic a quote being processed, click:

```text
Send to underwriting review
```

The UI briefly shows a routing state, updates the quote status to `In Review`, and then displays the allocated underwriter. Underwriter allocation is handled by the server so it works in both Claude Desktop and the standalone browser UI. The quote browser also shows the allocated underwriter when one exists.

To browse existing quotes, ask Claude:

```text
Use get_quote to list property_owners quotes and show the quote UI.
```

Calling `get_quote` without a `quoteId` returns a quote list, optionally filtered by `productType`. Selecting a row in the embedded UI retrieves the full quote details.

To open the deterministic extracted data-points view for a quote, ask Claude:

```text
Use get_quote with quoteId Q-POC-4888587E and view data_points.
```

The same embedded quote UI will render a stable extraction screen with confidence, evidence, missing fields, warnings and product-specific schedules where available.

The quote UI also includes an entity graph view. It shows the insured, broker, risk, coverage, property locations, losses, attachments and data-quality signals as relationship nodes where available. Nodes are coloured with a red/amber/green accuracy indicator based on extraction confidence, missing fields and warning signals. Use the graph toolbar to recenter the view around the insured, risk or broker.

Locations, coverage lines, loss history, attachments and data quality are grouped by default to keep the graph readable. Select a group node and use `Expand group` or `Collapse group` to show or hide the individual entries. Nodes can be dragged around the graph canvas to make relationships easier to inspect, and `Reset layout` returns the graph to its default grouped layout. Double-click a node, or select it and click `Open detail`, to jump back to the relevant quote record or data-points view.

The MCP tools expect Claude to pass the uploaded document text from the prompt into the tool call. They no longer require or accept an absolute local file path for submission processing.

## PDF Submissions

The intake tools accept two document input modes:

```text
documentText
```

Use this when Claude Desktop can read the uploaded document text from the chat or when you paste the broker submission into the prompt.

```text
documentBase64 + mimeType: application/pdf + fileName
```

Use this when the MCP host can pass the uploaded PDF bytes directly to the tool. The server extracts machine-readable text from the PDF before classification and extraction. Scanned image-only PDFs are not OCR'd in this PoC; those should be converted with OCR before intake.

The extraction pipeline now avoids filling missing insured/broker fields with demo defaults. Missing extracted fields are left blank and listed in `dataQuality.missingFields` so the embedded quote UI can be used for human correction. Extracted fields also include lightweight label/evidence/confidence metadata under `dataQuality.evidence`.

## Property Owners Schema

The server includes a property-specific extraction tool:

```text
extract_property_submission
```

To persist the extracted property schedule on a quote and render it in the embedded quote UI, pass the property extraction result to:

```text
create_quote
```

Use it for property owners package submissions where the broker document contains portfolio-level property datapoints. The tool validates the output against a dedicated property schema covering:

- Broker details and submission reference
- Named insured, industry code, rental income, employees and operations
- Buildings and landlord contents, loss of rent, property owners liability, terrorism and engineering inspection/breakdown
- Scheduled premises, construction, year built, stories, TIV, occupancy and notes
- Loss history, paid/reserved amounts and descriptions
- Attachments and potential intake issues
- Underwriting narrative, deductible constraints and broker instructions
- Missing fields, warnings and extraction evidence

`create_quote` accepts either a generic `submission` from `extract_submission` or a product-specific `productSubmission` envelope from `extract_property_submission`. Property owners output is stored on the quote as `productType: "property_owners"`, `productSubmission` and `productData`, including `locations`, `lossHistory`, coverage details and underwriting data.

When a quote is moved to `In Review`, the server adds an `underwriter` allocation to the quote record with:

- Name
- Team
- Email
- Allocation timestamp
- Allocation rationale

Product-specific schemas are organized around a shared envelope:

```text
server/src/schemas/common.schema.ts
server/src/schemas/productSubmission.schema.ts
server/src/schemas/products/propertyOwners.schema.ts
server/src/products/registry.ts
```

Add new lines of business by adding a product schema, extractor and registry entry. The quote UI renders product panels by `quote.productType`.

## MCP App UI

The `create_quote` tool is registered as an MCP App tool. It returns the created quote as structured content and points Claude to the `ui://quote-record/index.html` app resource. The server reads that iframe resource from:

```text
apps/quote-ui/dist/index.html
```

Run `npm run build` after React UI or server changes so Claude receives the latest embedded app and MCP server code.

The embedded UI currently supports:

- Browsing and filtering quotes
- Opening a quote record
- Editing insured details
- Viewing property owners coverage, locations and loss history
- Sending a quote to underwriting review
- Viewing the allocated underwriter
- Marking a quote as quoted or declined

## Markdown Intake Playbook

The submission intake process is defined in Markdown rather than being fully hardcoded in TypeScript:

```text
server/playbooks/submission-intake.md
```

That file contains the skill-style operating instructions plus:

- Classification indicators
- Extraction label aliases
- Default values
- Covers requested
- Missing-field checks
- Data quality warnings

The MCP server also exposes the playbook as a readable MCP resource:

```text
skill://submission-intake/playbook.md
```

The TypeScript extraction service still performs the deterministic parsing and schema validation, but the insurance-specific data points now come from the Markdown playbook. Update the Markdown file when the intake rules change.

## Next production enhancements

- Add richer PDF and DOCX extraction for uploaded files
- Add LLM extraction guided by the Markdown playbook and validated by the Zod schema
- Store field-level evidence and confidence
- Add PostgreSQL persistence
- Add authenticated API access
- Add audit logging
- Add editable broker, risk and product-specific fields in the embedded React UI
- Add more MCP-backed underwriting actions beyond status and review allocation
