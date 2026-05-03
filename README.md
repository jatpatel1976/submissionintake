# Submission Intake MCP + Quote Record UI PoC

This repo is a runnable proof of concept for an AI-native insurance submission ingestion capability.

It includes:

- A local MCP server for Claude Desktop
- Tools to classify a document, extract submission data, create a quote and retrieve/update the quote
- A React/Vite quote record UI
- A sample broker submission text file you can upload or attach in Claude

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

## 3. Run the React quote UI

In one terminal:

```bash
npm run dev:ui
```

This starts the UI at:

```text
http://localhost:5173
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

## 5. Configure Claude Desktop

Open the Claude Desktop configuration file.

On macOS this is usually:

```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add this configuration, replacing the server path with your actual repo path:

```json
{
  "mcpServers": {
    "submission-intake": {
      "command": "npm",
      "args": [
        "--prefix",
        "/ABSOLUTE/PATH/TO/submission-intake-poc/server",
        "run",
        "dev"
      ],
      "env": {
        "UI_BASE_URL": "http://localhost:5173",
        "API_PORT": "8787"
      }
    }
  }
}
```

Restart Claude Desktop.

## 6. Demo in Claude Desktop

Keep the React UI running:

```bash
npm run dev:ui
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
Create a quote shell from the extracted submission and give me the quote record UI link.
```

Claude should call the MCP tools and return a local quote UI link such as:

```text
http://localhost:5173?quoteId=Q-POC-XXXXXXXX
```

Open that link to view the quote record UI.

The MCP tools expect Claude to pass the uploaded document text from the prompt into the tool call. They no longer require or accept an absolute local file path for submission processing.

## Current prototype limitation

This version returns a local quote UI link rather than a fully embedded Claude MCP App iframe. It is structured so you can evolve it into a full MCP App resource once your Claude Desktop build supports the Apps extension surface you want to target.

## Next production enhancements

- Add richer PDF and DOCX extraction for uploaded files
- Add LLM extraction into the Zod schema
- Store field-level evidence and confidence
- Add PostgreSQL persistence
- Add authenticated API access
- Add audit logging
- Add editable fields in the React UI
- Wire React buttons back to MCP tools or secured API endpoints
