# cc-devtool

AI Agent 执行调试工具 —— 可视化 Claude Code、Cursor、Codex 的 skill / rule / MCP / agent 命中及执行链路，追踪文件读写、CLI 命令、token 消耗。

## 特性

- **零配置**：安装即用，自动发现本地 agent 数据，无需修改已有工作环境
- **多 Agent 支持**：Claude Code / Cursor / Codex 三大 AI 编程助手
- **会话时间线**：逐轮展示用户指令、AI 思考、工具调用和结果
- **文件影响分析**：哪些文件被读取、创建、修改、删除
- **Agent 执行图**：多 agent 层级关系与调用拓扑（React Flow）
- **Dashboard 面板**：工具使用分布、token 消耗趋势、shell 命令、skill/rule/MCP 命中详情
- **原始文件预览**：直接查看 agent 日志源文件，支持 JSONL 折叠与搜索
- **数据完整度指示**：明确标注每个会话的工具调用 / token / 文件操作数据可用性
- **透明代理（可选）**：捕获 API 请求/响应，补全 Cursor 等缺失的 token 数据，可与 cc-switch 链式使用
- **实时监控**：WebSocket + 文件监听，会话变化自动刷新
- **桌面应用**：Tauri 打包为原生桌面应用（开发中）

## 安装

```bash
npm install -g cc-devtool
```

要求 Node.js >= 18。

## 快速开始

```bash
# 启动面板（自动打开浏览器）
cc-devtool

# 指定端口
cc-devtool serve --port 3000

# 启动面板 + API 代理
cc-devtool serve --with-proxy

# 仅启动代理（无面板）
cc-devtool proxy
```

打开 `http://localhost:4173` 即可查看所有 AI agent 会话。

## CLI 命令

```
cc-devtool [command] [options]

Commands:
  serve (默认)     启动面板服务器
  proxy            仅启动透明代理
  start            serve 的别名

serve 选项:
  -p, --port <number>            面板端口 (默认: 4173)
  --no-open                      不自动打开浏览器
  --with-proxy                   同时启动 API 代理
  --proxy-port <number>          代理端口 (默认: 4174)
  --anthropic-upstream <url>     Anthropic 上游地址
  --openai-upstream <url>        OpenAI 上游地址

proxy 选项:
  -p, --port <number>            代理端口 (默认: 4174)
  --anthropic-upstream <url>     Anthropic 上游 (默认: https://api.anthropic.com)
  --openai-upstream <url>        OpenAI 上游 (默认: https://api.openai.com)
```

## 面板功能

### Sessions（会话列表）

浏览所有 agent 的历史会话，按工具类型、数据源过滤，支持关键词搜索。每个会话卡片展示：
- agent 类型与模型名称
- 对话轮数、工具调用次数、文件操作数
- token 消耗总量
- 数据完整度指示条（工具调用 / token / 文件操作）

### Session Detail（会话详情）

五个标签页：

| 标签 | 内容 |
|------|------|
| Timeline | 逐轮展示对话、思考过程、工具调用详情 |
| File Impact | 按文件路径分组的读写操作统计 |
| Agent Graph | 多 agent 层级拓扑图 |
| Dashboard | 工具分布图表、token 消耗趋势、shell 命令列表、skill/rule/MCP 命中 |
| Raw | 原始日志文件预览（JSONL 折叠/搜索） |

### Proxy（代理管理）

在界面中直接管理 API 代理：
- 一键启停代理
- 配置端口和上游 URL
- 查看捕获统计（数量、磁盘占用）
- 全局数据源切换（All / Local / Proxy）

## 透明代理

代理是**可选的**，用于捕获 AI agent 与 API 之间的请求/响应数据。这对于填补 Cursor 等本地存储中缺失的 token 用量数据特别有用。

### 使用方式

```bash
# 方式 1：在面板中启停（推荐）
cc-devtool serve
# 然后在 /proxy 页面点击 Start

# 方式 2：命令行启动
cc-devtool serve --with-proxy

# 方式 3：独立运行代理
cc-devtool proxy
```

### 指向代理

```bash
# Claude Code
ANTHROPIC_BASE_URL=http://localhost:4174/anthropic claude

# Codex
OPENAI_BASE_URL=http://localhost:4174/openai codex
```

### 与 cc-switch 共存

cc-devtool 代理可以与 cc-switch 链式使用，互不冲突：

```
Agent --> cc-devtool :4174 --> cc-switch --> API Provider
```

配置方式：将 cc-devtool 的上游地址指向 cc-switch：

```bash
cc-devtool proxy --anthropic-upstream http://localhost:<cc-switch-port>
```

> **注意**：Cursor 通过其内部代理路由 API 调用，无法被 cc-devtool 代理拦截。Cursor 的数据通过被动读取本地文件和 SQLite 数据库获取。

## 数据源

cc-devtool 从以下位置被动读取 agent 数据：

| Agent | 数据位置 | 数据完整度 |
|-------|---------|-----------|
| Claude Code | `~/.claude/projects/**/*.jsonl` | 最完整：工具调用、token、thinking、MCP |
| Cursor | `~/.cursor/projects/**/*.jsonl` + `ai-code-tracking.db` | 部分：文件操作和模型从 SQLite 补充，token 需代理 |
| Codex | `~/.codex/sessions/**/*.jsonl` + `state_5.sqlite` | 接近完整：工具调用、token、git 上下文 |
| Proxy | `~/.cc-devtool/captures/*.jsonl` | API 级：token 用量、模型、请求元数据 |

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（前端热更新）
pnpm dev          # Vite 开发服务器 :5173
pnpm serve        # 后端服务器 :4173（tsx 直接运行）

# 类型检查
pnpm build:check

# 构建
pnpm build        # 编译 server + 构建前端 -> dist/

# 测试全局安装
npm link
cc-devtool --version
```

### 项目结构

```
cc-devtool/
├── bin/                    # CLI 入口
├── cli/                    # 命令行定义
├── server/                 # Express 后端
│   ├── api/                #   REST API 路由
│   ├── parsers/            #   各 agent 解析器
│   │   ├── claude-code.ts  #     Claude Code .jsonl
│   │   ├── cursor.ts       #     Cursor .jsonl / .txt
│   │   ├── cursor-db.ts    #     Cursor SQLite 补充
│   │   ├── codex.ts        #     Codex .jsonl
│   │   ├── codex-db.ts     #     Codex SQLite 补充
│   │   └── proxy-capture.ts#     代理捕获数据
│   ├── proxy/              #   透明 API 代理
│   │   ├── manager.ts      #     生命周期管理
│   │   ├── anthropic.ts    #     Anthropic 转发
│   │   └── openai.ts       #     OpenAI 转发
│   ├── watcher.ts          #   文件变更监听
│   └── websocket.ts        #   实时推送
├── shared/                 # 前后端共享类型
├── src/                    # React 前端
│   ├── components/         #   UI 组件
│   │   ├── timeline/       #     时间线
│   │   ├── file-impact/    #     文件影响
│   │   ├── agent-graph/    #     Agent 拓扑图
│   │   ├── dashboard/      #     数据面板
│   │   ├── proxy/          #     代理管理
│   │   ├── sessions/       #     会话列表
│   │   └── raw/            #     原始文件预览
│   ├── pages/              #   页面
│   ├── stores/             #   Zustand 状态
│   └── lib/                #   API 客户端
├── src-tauri/              # Tauri 桌面应用
└── dist/                   # 构建输出
    ├── cli/                #   编译后的 CLI
    ├── server/             #   编译后的服务端
    ├── shared/             #   编译后的共享类型
    └── public/             #   前端静态资源
```

### 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + Vite + TailwindCSS + Zustand |
| 图表 | Recharts + @xyflow/react |
| 后端 | Node.js + Express 5 + WebSocket |
| 数据库 | better-sqlite3（读取 agent SQLite） |
| CLI | Commander |
| 桌面 | Tauri 2（开发中） |

## 桌面应用（开发中）

cc-devtool 计划通过 Tauri 打包为原生桌面应用。需要 Rust 工具链：

```bash
# 开发
pnpm tauri:dev

# 构建安装包
pnpm tauri:build
```

## 许可证

MIT
