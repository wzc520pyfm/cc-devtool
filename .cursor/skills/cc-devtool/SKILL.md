---
name: cc-devtool
description: >-
  AI Agent session debugger that visualizes execution chains, skill/rule/MCP hits,
  file operations, and token usage across Claude Code, Cursor, and Codex.
  Use when developing, debugging, or extending cc-devtool features, parsers,
  API endpoints, or frontend components.
---

# cc-devtool

Cross-platform AI agent session debugger. Parses transcript data from Claude Code, Cursor, and Codex, surfaces it through a REST API + WebSocket, and renders an interactive React dashboard.

## Architecture

```
cli/index.ts            → Commander CLI entry (serve / start)
server/
  index.ts              → Express + static files + WebSocket upgrade
  api/sessions.ts       → REST API: /api/sessions, /api/sessions/:tool/:id, /api/tools
  websocket.ts          → WS broadcast to connected clients
  watcher.ts            → chokidar file watcher → invalidates cache → broadcasts updates
  parsers/
    detect.ts           → Auto-detect installed tools, aggregate all sessions
    claude-code.ts      → Parse ~/.claude/projects/*/*.jsonl
    cursor.ts           → Parse ~/.cursor/projects/*/agent-transcripts/ (.jsonl + .txt)
    codex.ts            → Parse ~/.codex/sessions/ (index.json + date-organized .jsonl)
    types.ts            → Re-exports shared/types.ts + categorizeToolCall helper
    utils.ts            → readJsonlFile, extractUserQuery, genId, safeTimestamp
shared/types.ts         → Unified data model (Session, Turn, ToolCall, FileOp, AgentNode…)
src/
  App.tsx               → React Router: / → SessionListPage, /session/:tool/:id → SessionDetailPage
  stores/sessionStore.ts → Zustand store + useFilteredSessions hook
  lib/api.ts            → Frontend API client
  hooks/useWebSocket.ts → Auto-reconnecting WS client hook
  pages/                → SessionListPage, SessionDetailPage
  components/
    layout/Layout.tsx   → Sidebar + Outlet
    sessions/           → SessionList, SessionFilters
    timeline/           → Timeline, TurnCard, ToolCallCard
    file-impact/        → FileImpactView
    agent-graph/        → AgentGraph (@xyflow/react)
    dashboard/          → ToolDashboard (recharts)
```

## Data Model

Core types in `shared/types.ts`:

- **Session** — full parsed session with turns, fileOps, agents, skillHits, mcpCalls, ruleRefs, tokenUsage
- **SessionSummary** — lightweight list item with counts and filePath
- **Turn** — one user/assistant/system message with ContentBlock[]
- **ContentBlock** — text | thinking | tool_use | tool_result
- **ToolCall** — name, category (file_read/file_write/shell/search/skill/mcp/agent/other), input, output
- **FileOp** — path, operation (read/create/update/delete), timestamp
- **AgentNode** — id, parentId, model, name (for agent hierarchy graph)
- **SkillHit / McpCall / RuleRef** — extracted metadata for dashboard stats

`categorizeToolCall(name)` maps tool names to categories for dashboard charts.

## Data Sources

| Tool | Base Dir | Session Discovery | Format |
|------|----------|-------------------|--------|
| Claude Code | `~/.claude/projects/` | Glob `*/*.jsonl` | JSONL: `{type, message, ...}` per line |
| Cursor | `~/.cursor/projects/*/agent-transcripts/` | Dirs with `<uuid>/<uuid>.jsonl` + `<uuid>.txt` | JSONL: `{role, message}` |
| Codex | `~/.codex/sessions/` | `index.json` → thread entries → date-organized `.jsonl` | JSONL: `{type, payload, timestamp}` |

Cursor parser deduplicates by session ID, **preferring `.txt` over `.jsonl`** because `.txt` files contain tool call data (`[Tool call]` markers) while `.jsonl` files only contain text messages.

## API Endpoints

```
GET /api/tools                  → DetectedTool[] (which AI tools are installed)
GET /api/sessions               → SessionSummary[] (cached 10s TTL)
GET /api/sessions/:tool/:id     → Session (full parsed detail)
WS  /ws                         → { type: 'session_update', payload: { file, event, timestamp } }
```

Session list cache is invalidated on file change (via watcher).

## Frontend Views

**SessionListPage** — filter by tool (All/Claude Code/Cursor/Codex), text search, session cards with badges + stats.

**SessionDetailPage** — 4 tabs:
- **Timeline** — chronological turns with role icons, thinking badges, token counts, expandable tool_use blocks
- **File Impact** — grouped by operation type (read/write/create), file paths with timestamps
- **Agent Graph** — @xyflow/react graph of agent hierarchy (main → subagents)
- **Dashboard** — recharts: 6 stat cards (tool calls, files read, files written, shell cmds, skills, rules), bar chart (tool distribution), pie chart (category breakdown), token breakdown (input/output/cache split with ratio bar), stacked area chart (token over time), shell commands list (expandable with output), skills invoked list (with full paths), rules referenced list, MCP calls list

## Usage

### Production

```bash
pnpm build          # TypeScript compile + Vite bundle
pnpm serve          # Start Express on :4173, auto-open browser
pnpm serve -- -p 3000 --no-open   # Custom port, no browser
```

### Development (hot-reload)

```bash
# Terminal 1: backend API server
pnpm serve -- --no-open

# Terminal 2: Vite dev server (proxies /api and /ws to :4173)
pnpm dev
```

Vite config in `vite.config.ts` proxies `/api` → `http://localhost:4173` and `/ws` → `ws://localhost:4173`.

## Debugging

### Frontend

Run `pnpm dev` for full React error messages + HMR. Open browser DevTools for console errors, network requests.

### Backend API

```bash
curl http://localhost:4173/api/tools
curl http://localhost:4173/api/sessions
curl http://localhost:4173/api/sessions/claude-code/<id>
curl http://localhost:4173/api/sessions/cursor/<id>
curl http://localhost:4173/api/sessions/codex/<id>
```

### Parser debugging

Parsers are the most fragile part — each AI tool has a unique log format. Test a parser in isolation:

```bash
npx tsx -e "
import { parseClaudeCodeSession } from './server/parsers/claude-code.js'
const s = await parseClaudeCodeSession('/path/to/session.jsonl')
console.log(JSON.stringify(s.turns.length, null, 2))
"
```

### WebSocket

In browser console:

```javascript
const ws = new WebSocket('ws://localhost:4173/ws')
ws.onmessage = e => console.log(JSON.parse(e.data))
```

### TypeScript

```bash
npx tsc --noEmit   # Type-check without emitting
```

## Skill / Rule / Shell Detection

All parsers use shared path-matching logic:

- **Skills**: Detected when a `Read` tool targets a path matching `SKILL.md` or containing `/skills/`. The skill name is extracted as the last 2 path segments (e.g., `sync-react-to-vue/SKILL.md`). Claude Code also detects the native `Skill` tool.
- **Rules**: Detected when a `Read` tool targets `.cursor/rules/`, `.cursorrules`, `CLAUDE.md`, `AGENTS.md`, `.claude/settings`, or `rules/*.md` / `rules/*.mdc`. Note: Cursor injects rules into the system prompt silently — they won't appear as explicit Read calls.
- **Shell commands**: All `Shell` tool calls. Command text and description are extracted from tool input. Results are shown when expanded.
- **MCP calls**: `CallMcpTool` / `call_mcp_tool` with server name and tool name.
- **Token usage**: Claude Code provides per-turn token breakdowns (input/output/cache). Cursor transcripts don't include token data. Codex provides total session token counts.

## Common Pitfalls

- **Zustand selectors**: Never call store methods inside selectors (`s => s.method()`). This creates new references each render → infinite loop. Use standalone hooks that select primitive/stable values.
- **Express 5 wildcards**: Use `/{*path}` not `*` for catch-all routes.
- **React 19 useRef**: Must pass initial value — `useRef<T>(undefined)` not `useRef<T>()`.
- **Cursor session dedup**: Same session can exist as both `.jsonl` and `.txt`. Parser prefers `.txt` because it's always complete.
- **Cursor JSONL dual format**: Newer Cursor versions write structured `tool_use` content blocks (with `name` + `input`) directly into JSONL. Older versions only wrote `text` blocks. The parser auto-detects which format is present and handles both. `ApplyPatch` tool calls contain file paths in patch text format.
- **Cache headers**: `index.html` must be `no-cache`; hashed assets under `/assets/` can be `immutable`.
- **Codex date dirs**: Sessions are organized `year/month/day/*.jsonl` — parser must traverse 3 levels.

## Extending

### Adding a new AI tool parser

1. Create `server/parsers/<tool>.ts` exporting `list<Tool>Sessions()` and `parse<Tool>Session(filePath)`
2. Register in `server/parsers/detect.ts`: add to `detectTools()` and `listAllSessions()`
3. Add watch path in `server/watcher.ts`
4. Add tool badge colors in `SessionList.tsx` and `SessionDetailPage.tsx`

### Adding a new dashboard panel

1. Add data extraction in the parser (populate `session.skillHits`, `session.mcpCalls`, etc.)
2. Create component in `src/components/dashboard/`
3. Render conditionally in `ToolDashboard.tsx`

### Adding a new detail tab

1. Add tab entry in `SessionDetailPage.tsx` `tabs` array
2. Create view component in `src/components/<tab-name>/`
3. Add conditional render in the tab content area
