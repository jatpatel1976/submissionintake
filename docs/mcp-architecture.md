# MCP Architecture Mapping

This project is a local MCP server plus an embedded MCP App UI and a small HTTP sidecar for standalone UI development.

## Project Shape

```mermaid
flowchart LR
  Claude["Claude Desktop<br/>MCP host"] <-->|"stdio JSON-RPC"| MCP["submission-intake MCP server<br/>server/src/index.ts"]

  MCP --> Register["MCP primitive registration<br/>server/src/mcp/register.ts"]
  Register --> Resources["Resources"]
  Register --> Tools["Tools"]
  Register --> Prompts["Prompts"]

  Resources --> QuoteUI["ui://quote-record/index.html<br/>apps/quote-ui/dist/index.html"]
  Resources --> Playbook["skill://submission-intake/playbook.md<br/>server/playbooks/submission-intake.md"]

  Tools --> Intake["Document intake tools"]
  Tools --> QuoteWorkflow["Quote workflow tools"]
  Tools --> Mutations["Quote update tools"]

  Intake --> Parser["documentParser.ts<br/>text/PDF parsing"]
  Intake --> Extractors["extractionService.ts<br/>propertyExtractionService.ts"]
  Extractors --> Schemas["Zod schemas<br/>server/src/schemas"]
  Extractors --> Playbook

  QuoteWorkflow --> Repo["quoteRepository.ts"]
  Mutations --> Repo
  Repo --> QuoteFiles["Quote JSON files<br/>server/src/data/quotes"]

  QuoteUIRuntime["React quote UI<br/>apps/quote-ui/src/main.tsx"] <-->|"calls app-visible MCP tools<br/>inside Claude"| MCP
  QuoteUIRuntime <-->|"fetch/PATCH during local dev"| API["Express quote API<br/>localhost:8787"]
  API --> Repo
```

## MCP Primitives

```mermaid
flowchart TB
  Server["McpServer<br/>name: submission-intake"]

  Server --> R["Resources<br/>readable context/assets"]
  Server --> T["Tools<br/>actions and mutations"]
  Server --> P["Prompts<br/>guided workflows"]

  R --> R1["Quote Record UI<br/>ui://quote-record/index.html<br/>MCP App HTML resource"]
  R --> R2["Submission Intake Playbook<br/>skill://submission-intake/playbook.md<br/>Markdown extraction rules"]

  T --> T1["classify_document<br/>classify uploaded/pasted document"]
  T --> T2["extract_submission<br/>generic commercial extraction"]
  T --> T3["extract_property_submission<br/>property owners extraction"]
  T --> T4["create_quote<br/>create quote and render Quote UI"]
  T --> T5["get_quote<br/>list quotes, retrieve quote, optional data_points view"]
  T --> T6["update_quote_status<br/>status/review workflow"]
  T --> T7["update_quote<br/>editable quote fields"]

  P --> P1["upload_submission<br/>classification starter"]
  P --> P2["extract_submission<br/>extraction starter"]
  P --> P3["create_quote<br/>quote creation starter"]
  P --> P4["get_quote<br/>browse/retrieve starter"]
```

## Request Flow

```mermaid
sequenceDiagram
  participant User
  participant Claude as Claude Desktop
  participant MCP as MCP server
  participant Parser as Document parser
  participant Extractor as Extraction service
  participant Repo as Quote repository
  participant UI as Quote Record UI

  User->>Claude: Upload or paste broker submission
  Claude->>MCP: classify_document(documentText or PDF bytes)
  MCP->>Parser: parseDocumentInput
  Parser-->>MCP: normalized text
  MCP->>Extractor: classifySubmission
  Extractor-->>MCP: classification + confidence
  MCP-->>Claude: structuredContent

  Claude->>MCP: extract_property_submission or extract_submission
  MCP->>Parser: parseDocumentInput
  Parser-->>MCP: normalized text
  MCP->>Extractor: extract + validate against Zod schema
  Extractor-->>MCP: structured submission
  MCP-->>Claude: structuredContent

  Claude->>MCP: create_quote(submission or productSubmission)
  MCP->>Repo: saveQuote
  Repo-->>MCP: persisted quote
  MCP-->>Claude: quote structuredContent + UI resource hint
  Claude->>UI: render ui://quote-record/index.html

  UI->>MCP: get_quote / update_quote_status / update_quote
  MCP->>Repo: read or update quote JSON
  Repo-->>MCP: quote or quote list
  MCP-->>UI: structuredContent
```

## Why Each Primitive Fits

| Primitive | Project usage | Why it fits |
|---|---|---|
| Resource | `ui://quote-record/index.html` | Static app asset that Claude can render. |
| Resource | `skill://submission-intake/playbook.md` | Reference/context read by clients and services. |
| Tool | `classify_document`, `extract_submission`, `extract_property_submission` | Deterministic work over user-provided input. |
| Tool | `create_quote`, `get_quote`, `update_quote_status`, `update_quote` | Quote workflow actions and data access. |
| Prompt | `upload_submission`, `extract_submission`, `create_quote`, `get_quote` | Reusable instructions that guide Claude to call the right tools. |

## Source Files

| Area | File |
|---|---|
| MCP bootstrap and Express sidecar | `server/src/index.ts` |
| MCP resource/tool/prompt registration | `server/src/mcp/register.ts` |
| Quote persistence | `server/src/services/quoteRepository.ts` |
| Document parsing | `server/src/services/documentParser.ts` |
| Generic extraction | `server/src/services/extractionService.ts` |
| Property owners extraction | `server/src/services/propertyExtractionService.ts` |
| Product schemas | `server/src/schemas` |
| Embedded MCP App source | `apps/quote-ui/src/main.tsx` |
| Built MCP App resource | `apps/quote-ui/dist/index.html` |
