# Parser Formats Reference

Detailed format documentation for each AI tool's transcript data.

## Claude Code (`~/.claude/projects/`)

Directory structure: `<project-slug>/<session-id>.jsonl`

Each line is a JSON object:

```jsonl
{"type":"summary","summary":"..."}
{"parentMessageId":"...","role":"user","message":{"content":[{"type":"text","text":"..."}]}}
{"parentMessageId":"...","role":"assistant","message":{"content":[{"type":"text","text":"..."},{"type":"tool_use","name":"Read","input":{"file_path":"..."}}]},"costInfo":{"inputTokens":...,"outputTokens":...,"cacheCreationInputTokens":...,"cacheReadInputTokens":...}}
{"parentMessageId":"...","role":"user","message":{"content":[{"type":"tool_result","name":"Read","content":"..."}]}}
```

Key fields:
- `role`: user | assistant
- `message.content[]`: array of `{type, text}` or `{type, name, input}` (tool_use) or `{type, content}` (tool_result)
- `costInfo`: token breakdown per assistant turn
- `type: "summary"`: session summary record (skipped during parsing)
- System turns: content starting with `<` is treated as system

## Cursor (`~/.cursor/projects/*/agent-transcripts/`)

Two formats co-exist:

### JSONL format (`<uuid>/<uuid>.jsonl`)

```jsonl
{"role":"user","message":{"content":[{"type":"text","text":"..."}]}}
{"role":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
```

Simpler than Claude Code — no `costInfo`, no `type` field. Subagent detection via `subagent_id` or `agent_id` fields.

### TXT format (`<uuid>.txt`)

Plain text with markers:

```
================================ Human Message =================================
User message text here

================================== Ai Message ==================================
Assistant response here

================================= Tool Message =================================
Tool output here
```

Parsed by splitting on `===` marker lines and detecting role from header text.

## Codex (`~/.codex/sessions/`)

Index file: `index.json` — array of `{ id, thread_name, created_at, ... }`

Session files organized by date: `<year>/<month>/<day>/<thread-id>.jsonl`

```jsonl
{"type":"session_meta","payload":{"id":"...","cwd":"...","model_provider":"..."},"timestamp":"..."}
{"type":"response_item","payload":{"role":"user","content":[{"type":"input_text","text":"..."}]},"timestamp":"..."}
{"type":"response_item","payload":{"role":"assistant","content":[{"type":"output_text","text":"..."}]},"timestamp":"..."}
{"type":"response_item","payload":{"type":"function_call","name":"shell","arguments":"{...}"},"timestamp":"..."}
{"type":"response_item","payload":{"type":"function_call_output","output":"..."},"timestamp":"..."}
{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":...,"output_tokens":...,"total_tokens":...}}},"timestamp":"..."}
```

Key `type` values:
- `session_meta`: session metadata (cwd, model, id)
- `response_item`: user/assistant messages and function calls
- `event_msg`: token usage reports, agent messages

Function calls use `payload.type: "function_call"` with `name` and JSON-stringified `arguments`.
