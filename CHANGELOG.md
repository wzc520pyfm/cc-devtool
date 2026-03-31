# Changelog

All notable changes to cc-devtool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.1.3] - 2026-03-31

### Enhanced

- **Full Proxy Data Capture**: Proxy now captures complete content blocks from API streams — tool calls with full parameters, assistant text, thinking blocks, and user messages (previously only captured metadata)
- **Rich Proxy Session Parsing**: Proxy captures are parsed into full Sessions with tool calls, file operations, skill hits, MCP calls, and rule references (previously showed only summary placeholders)
- **cc-switch Auto-Detection**: Proxy config page automatically detects cc-switch installation by reading `~/.cc-switch/cc-switch.db`, showing detected address/port with one-click Apply button
- **Proxy Page UI Refresh**: Updated descriptions and added "What Gets Captured" visual grid showing all captured data types (tool calls, token usage, thinking, file ops)

### Technical

- Anthropic stream: full content block reconstruction via delta accumulation (`content_block_start` → `content_block_delta` → `content_block_stop`)
- OpenAI stream: captures full output items from `response.completed` events and Chat Completions delta accumulation
- Non-streaming responses: extracts content blocks from response body
- `dataAvailability` for proxy captures upgraded from `partial`/`none` to `full` when content blocks are present

## [0.1.2] - 2026-03-31

### Fixed

- Fix macOS app crash on launch caused by deprecated `plugins.shell.scope` config (Tauri v2 only supports `open` field)
- Fix white screen after launch by serving frontend from Tauri bundled assets instead of sidecar (pkg binary doesn't include frontend files)
- Fix empty data in desktop app by adding CORS headers to sidecar API (Tauri webview origin differs from localhost:4173)
- Fix macOS x64 cross-compilation failure by replacing `reqwest` with std `TcpStream` for server readiness check
- Fix CI release not publishing when one platform build fails

## [0.1.0] - 2026-03-23

First release of cc-devtool — an AI agent execution debugger that visualizes skill, rule, MCP, and agent execution chains across Claude Code, Cursor, and Codex.

**Stats**: 9 commits | 70 files changed | +3,800 insertions

### Added

- **Multi-Agent Session Parsing**: Adapters for Claude Code (`.jsonl`), Cursor (`.jsonl` / `.txt` + `ai-code-tracking.db`), and Codex (`index.json` / `.jsonl` + `state_5.sqlite`)
- **Session Timeline**: Turn-by-turn display of user messages, AI thinking, tool calls, and results with collapsible content blocks
- **File Impact Analysis**: Per-file read/write/create/delete operation tracking grouped by file path
- **Agent Execution Graph**: Multi-agent hierarchy and call topology visualization using React Flow
- **Dashboard Panel**: Tool usage distribution charts, token consumption trends, shell command listing, and skill/rule/MCP hit details using Recharts
- **Raw File Preview**: Direct viewing of agent log source files with JSONL record collapsing, filtering, and search
- **Data Availability Indicators**: Explicit per-session indicators showing whether tool calls, tokens, and file operations data is `full`, `partial`, or `none` with reasons
- **SQLite Data Enrichment**: Passive reading of Cursor `ai-code-tracking.db` and Codex `state_5.sqlite` databases to supplement missing data (file operations, model info, token counts, git context)
- **Transparent API Proxy** (optional): Captures Anthropic and OpenAI API request/response traffic for comprehensive token tracking; supports SSE streaming; chainable with cc-switch and other proxies
- **Proxy Control Panel**: In-app proxy management with start/stop controls, port/upstream configuration, capture statistics, and global data source switching (All / Local Only / Proxy Only)
- **Real-time Monitoring**: WebSocket + chokidar file watching for automatic session list refresh on transcript changes
- **CLI Tool**: `cc-devtool serve` (dashboard), `cc-devtool proxy` (standalone proxy), with configurable ports and upstream URLs
- **npm Global Install**: Packaged for `npm install -g cc-devtool` with proper `bin`, `files`, and `engines` configuration
- **Tauri Desktop App** (scaffold): Sidecar architecture to run the Node.js server within a native Tauri 2 desktop application
- **Session Filtering**: Filter by agent type (Claude Code / Cursor / Codex), data source (local / proxy), and keyword search
- **Proxy Configuration Persistence**: Settings saved to `~/.cc-devtool/config.json` across restarts with auto-start support

### Technical

- React 19 + Vite 8 + TailwindCSS 4 frontend
- Express 5 + WebSocket backend
- Zustand state management
- better-sqlite3 for reading agent databases
- Commander CLI framework
- TypeScript strict mode throughout
