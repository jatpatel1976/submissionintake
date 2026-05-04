# Submission Intake MCP + Quote Record UI PoC

This repo is a runnable proof of concept for an AI-native insurance submission ingestion capability.

It includes:

- A local MCP server for Claude Desktop
- Tools to classify a document, extract submission data, create a quote and retrieve/update the quote
- A React/Vite quote record UI embedded inline in Claude as an MCP App iframe
- A Markdown submission intake playbook that drives classification indicators, extraction labels, defaults and data quality checks
- A sample broker submission text file you can upload or attach in Claude Desktop

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

## Submission Intake Tests

Run the submission ingestion and output tests with:

```bash
npm run test:submission
```

This reads `samples/sample-submission.txt`, classifies it, extracts structured submission data, validates the output with the Zod schemas, and checks the quote-shaped output produced from the extracted submission.

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
      "args": [
        "/ABSOLUTE/PATH/TO/submission-intake-poc/server/dist/index.js"
      ],
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

You can also run the workflow with MCP prompts as slash commands after attaching the submission file:

```text
/upload_submission
/extract_submission
/create_quote
```

Depending on your Claude Desktop version, MCP prompts may appear under the server name:

```text
/submission-intake:upload_submission
/submission-intake:extract_submission
/submission-intake:create_quote
```

Claude should call the MCP tools and render the quote record UI inline in the conversation as an MCP App iframe. The status buttons in the embedded UI call the `update_quote_status` MCP tool.

The MCP tools expect Claude to pass the uploaded document text from the prompt into the tool call. They no longer require or accept an absolute local file path for submission processing.

## MCP App UI

The `create_quote` tool is registered as an MCP App tool. It returns the created quote as structured content and points Claude to the `ui://quote-record/index.html` app resource. The server reads that iframe resource from:

```text
apps/quote-ui/dist/index.html
```

Run `npm run build` after React UI or server changes so Claude receives the latest embedded app and MCP server code.

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
- Add editable fields in the embedded React UI
- Add more MCP-backed underwriting actions
