<p align="center">
  <img src="assets/shineo-logo.svg" width="96" alt="Shineo logo">
</p>

<h1 align="center">Shineo CLI</h1>

<p align="center">
  面向 Shineo 平台的跨平台命令行工具，让任意 Agent 直接参与 Shineo 项目的开发与交付。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@shineo/cli"><img src="https://img.shields.io/npm/v/@shineo/cli?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@shineo/cli"><img src="https://img.shields.io/npm/dm/@shineo/cli?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/PANDeng-FQG/shineo-cli"><img src="https://img.shields.io/github/stars/PANDeng-FQG/shineo-cli?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22+"></a>
</p>

<p align="center">
  <a href="https://shineo.app">官方网站</a> ·
  <a href="https://www.npmjs.com/package/@shineo/cli">npm</a> ·
  <a href="skills/shineo-cli/SKILL.md">Agent Skill</a> ·
  <a href="https://github.com/PANDeng-FQG/shineo-cli/issues">问题反馈</a>
</p>

Shineo CLI 是 Shineo 平台的命令行入口。它把项目同步、平台工具、数据 API SDK、构建和发布能力带到终端，让 Claude Code、Codex、Trae、WorkBuddy 等任意 Agent 都可以在普通本地项目目录中工作，并通过 Shineo 完成项目交付。

CLI 不负责替代 Agent 的文件操作，也不创建本地 VFS、编译缓存或 Agent 适配器。Agent 使用项目自己的工具链读取和修改源码，Shineo CLI 负责把源码和平台操作提交到 Shineo。

## 核心能力

- **项目协作**：创建、克隆、拉取、推送项目源码，查看变更和 revision 历史。
- **平台交付**：调用 Shineo 服务端构建，读取构建诊断，并执行发布流程。
- **数据 API SDK**：通过 `dataApiSdk init` 初始化前端调用 Shineo 数据 API 所需的源码文件。
- **CMS 管理**：创建、查看、更新、删除 CMS，管理项目与 CMS 的绑定及访问权限。
- **云数据管理**：管理数据表、字段、记录、权限、文件夹、索引，以及数据导入导出。
- **设计能力**：初始化和维护项目设计资源，查询字体，执行设计检查和设计资源导出。
- **媒体管理**：上传、导入、查看、移动、更新和删除 CMS 媒体资源及文件夹。
- **Skill 与工具**：查询 Shineo Skill，读取 Skill 资源，并通过 Tool Gateway 调用平台工具。
- **自动化友好**：支持稳定的 JSON 输出、非交互令牌登录、统一退出码和跨平台运行。

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- 一个可访问的 Shineo 账号或 CI 令牌
- 一个 Shineo 项目，或创建项目所需的 workspace 权限

### 安装

```bash
npm install --global @shineo/cli
```

也可以不安装到全局目录，直接使用：

```bash
npx @shineo/cli --help
```

### 登录

浏览器登录：

```bash
shineo auth login
```

CI 或自动化环境使用令牌：

```bash
shineo auth login --token "$SHINEO_TOKEN"
```

认证信息保存在用户级配置目录，不会写入项目目录。检查当前登录状态：

```bash
shineo auth status
```

### 同步并交付项目

```bash
# 将远端项目拉取到当前目录
shineo project clone <project-id> .

# 查看本地和远端源码差异
shineo project status

# Agent 或开发者修改本地源码后提交 revision
shineo project push --message "更新首页交互"

# 请求 Shineo 服务端构建并查看诊断
shineo project build

# 同步源码、构建并进入发布流程
shineo project deploy
```

`project deploy` 会按顺序完成源码同步、服务端构建、构建校验和发布。发布审核、权限、额度和 CMS 绑定校验仍由 Shineo 服务端负责。

## 工作方式

```text
普通本地项目目录
       │
       ├── Claude Code / Codex / Trae / WorkBuddy
       │       └── 读取和修改源码，运行项目自己的本地工具链
       │
       └── Shineo CLI
               ├── project push / pull
               ├── CMS、数据、设计和媒体工具
               ├── Shineo 服务端构建
               └── 发布与状态查询
```

CLI 不包装 Vite、Webpack 或其他本地开发服务器。需要本地预览时，使用项目自身的 `npm run dev`、`pnpm dev` 或其他开发命令；需要交付 Shineo 项目时，再使用 CLI 同步、构建和发布。

## 命令概览

| 命令 | 用途 |
| --- | --- |
| `shineo auth` | 登录、查看登录状态和退出登录 |
| `shineo workspace` | 查看和切换 workspace，管理成员 |
| `shineo project` | 创建、同步、检查、构建、发布项目 |
| `shineo skill` | 查询 Skill、读取 Skill 内容和资源 |
| `shineo dataApiSdk` | 初始化前端使用的 Shineo 数据 API SDK 源文件 |
| `shineo design` | 管理设计资源、字体、检查和导出 |
| `shineo cms` | 管理 CMS 实例、访问权限和项目绑定 |
| `shineo data` | 管理表、字段、记录、权限、索引和数据文件夹 |
| `shineo media` | 管理 CMS 媒体资源和文件夹 |
| `shineo tool` | 查询并调用 Shineo 平台工具 |

所有命令支持以下根级选项：

```text
--json                 输出稳定的结构化 JSON
--verbose              输出请求调试信息
--language zh-CN       使用中文输出
--language en-US       使用英文输出
--host <url>           覆盖当前 Shineo API 地址
```

JSON 结果写入 stdout，进度和错误写入 stderr，适合脚本和 CI 使用。

## 平台能力示例

### 数据 API SDK

`dataApiSdk` 指的是前端调用 Shineo 数据 API 的 SDK 初始化，不是数据库建表或 CMS 初始化：

```bash
shineo dataApiSdk init
shineo dataApiSdk init --overwrite
```

命令从 Shineo 服务端获取 SDK 源文件并同步到项目的 `/.shineo/apisdk/*`。这些文件属于项目源码，可以由 Agent 或开发者继续修改和提交。

### CMS 与数据

```bash
shineo cms list --workspace <workspace-id>
shineo cms view <cms-id>
shineo cms bind <cms-id>

shineo data tables list --cms <cms-id>
shineo data fields list <table-id> --cms <cms-id>
shineo data records list --cms <cms-id> --input '{"tableId":"<table-id>","limit":20}'
shineo data records create --cms <cms-id> --input '{"tableId":"<table-id>","values":{"name":"Demo"}}'
shineo data permissions get --cms <cms-id>
```

### 设计与媒体

```bash
shineo design init
shineo design fonts --input '{"query":"sans","limit":10}'
shineo design lint
shineo design export --format css-tailwind

shineo media list --cms <cms-id>
shineo media upload ./public/logo.png --cms <cms-id>
shineo media folders list --cms <cms-id>
```

### Skill 与底层工具

```bash
shineo skill list
shineo skill show <skill-name>
shineo skill resource <skill-name> <resource-path>

shineo tool list
shineo tool call <tool-name> --input '{}'
shineo tool call <tool-name> --input '{}' --project
```

Skill 和工具结果默认直接输出，不会安装到本地 Skill 目录。完整参数以 `shineo tool list` 返回的服务端 schema 为准。

## 项目配置

项目根目录只保留一个绑定文件：`.shineo.json`。

```json
{
  "schemaVersion": 1,
  "apiUrl": "https://api.shineo.app",
  "projectId": "project-uuid",
  "workspaceId": "workspace-uuid",
  "projectName": "my-project",
  "revisionId": "revision-uuid"
}
```

源码保持普通目录结构。认证令牌保存在用户级配置中，不进入 Git 仓库，也不会写入 `.shineo.json`。`.shineo.json` 已加入本仓库 `.gitignore`，避免把具体项目绑定信息提交到公开仓库。

## Agent Skill

本仓库包含 Shineo CLI 配套 Skill，位于 [`skills/shineo-cli/`](skills/shineo-cli/)。它适用于能够读取项目 Skill 的 Claude Code、Codex、Trae、WorkBuddy 等 Agent，内容包括：

- Shineo CLI 的定位和使用边界
- 项目 clone、pull、push、build、deploy 流程
- `dataApiSdk`、Design、CMS、数据和媒体命令
- 冲突处理、权限校验、JSON 输出和 CI 使用规则

Skill 会随 npm 包一起发布，也可以直接从 GitHub 仓库读取。

## 本地开发

```bash
git clone git@github.com:PANDeng-FQG/shineo-cli.git
cd shineo-cli
npm install
npm run check
npm test
npm run build
```

构建产物位于 `dist/`，发布 npm 包前会由 `prepack` 自动重新构建。

## 相关链接

- [Shineo 官网](https://shineo.app)
- [npm package](https://www.npmjs.com/package/@shineo/cli)
- [GitHub Repository](https://github.com/PANDeng-FQG/shineo-cli)
- [问题反馈](https://github.com/PANDeng-FQG/shineo-cli/issues)
