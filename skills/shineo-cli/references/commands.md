# Shineo CLI 命令参考

所有命令都支持根级 `--json`、`--verbose`、`--language zh-CN|en-US`、`--host <url>` 和 `--profile <name>`。JSON 键保持英文稳定。

## 认证和工作区

```text
shineo auth login
shineo auth login --token <token>
shineo auth status
shineo auth logout
shineo workspace list
shineo workspace view <workspaceId>
shineo workspace use <workspaceId>
shineo workspace members <workspaceId>
```

令牌只存放在用户级配置目录。不要写入 `.shineo.json`、源码、命令历史或构建产物。

CLI 默认使用 `production` profile，地址为 `https://api.shineo.app`。其他 Shineo 服务可以使用独立 profile：

```bash
shineo --profile local --host http://localhost:3000 auth login
shineo config list
shineo config use production
shineo config use local
shineo config get
```

profile 用于保存不同服务的连接配置。

## 项目

```text
shineo project list [--workspace <workspaceId>]
shineo project create --workspace <workspaceId> --name <name> [--type default|components]
shineo project clone <projectId> [directory]
shineo project pull
shineo project push [-m <message>]
shineo project status
shineo project build
shineo project deploy
shineo project revisions
```

`project deploy` 会同步当前源码、调用服务端构建并进入正式发布流程。

## 技能、设计和工具

```text
shineo skill list
shineo skill show <skillName>
shineo skill resource <skillName> <resourcePath>
shineo dataApiSdk init [--overwrite]
shineo design init [--overwrite]
shineo design fonts [--input <json>]
shineo design lint
shineo design export [--format tailwind|tailwind-v4|css-tailwind|dtcg] [--target tailwindV3|tailwindV4]
shineo tool list
shineo tool call <toolName> --input <json> [--project]
```

`design` 命令需要当前目录有项目绑定配置。设计修改由服务端工具提交到项目 revision；不要把它理解成本地文件编辑器。

`dataApiSdk init` 初始化前端页面使用的 Shineo 数据 API SDK。它从服务端获取 SDK 源文件并写入当前项目的 `/.shineo/apisdk/*`，同时同步项目 revision；它不初始化数据表、字段、CMS，也不修改项目 dependencies。默认不覆盖本地已有 SDK 文件，使用 `--overwrite` 才会覆盖。

## CMS、云数据和媒体

```text
shineo cms list [--workspace <workspaceId>]
shineo cms create --workspace <workspaceId> --name <name> [--description <text>]
shineo cms view|update|delete|access <cmsId> [json]
shineo cms bind|unbind <cmsId>

shineo data tables list|get|create|update|duplicate|delete ...
shineo data fields list|create|update|reorder|delete ...
shineo data records list|get|create|update|set_cell|delete|aggregate|bulk|import|export ...
shineo data permissions get|collaborators|set_public|upsert_role|delete_role|set_record|set_field ...
shineo data folders list|create|update|delete ...
shineo data indexes list|create|delete ...
shineo data health <cmsId>
shineo data import <tableId> --cms <cmsId> --input <json>
shineo data export <tableId> --cms <cmsId> [--input <json>]

shineo media list|view|upload|import|move|update|delete ...
shineo media folders list|create|update|delete ...
```

数据和媒体命令的详细输入以 `shineo tool list` 返回的 schema 以及服务端错误为准。大多数数据操作需要 `--cms <cmsId>`，并且当前目录必须有 `.shineo.json`，因为服务端要验证项目与 CMS 的绑定和权限。
