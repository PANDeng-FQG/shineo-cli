---
name: shineo-cli
description: "使用 Shineo CLI 管理 Shineo 源码项目、源码同步、构建发布，以及 CMS、数据、设计和媒体等平台能力。适用于第三方 Agent 在本地项目中开发并交付 Shineo 应用。"
---

# Shineo CLI

Shineo CLI 是 Shineo 平台能力的命令行入口。第三方 Agent 负责读取和修改当前目录中的普通项目文件，项目自己的工具链负责本地开发和本地验证；CLI 负责项目绑定、源码同步、平台工具调用、服务端构建和发布。

先读取当前目录的 `.shineo.json`。它只保存 `projectId`、`workspaceId`、revision 等绑定元数据，不保存令牌。认证使用用户级配置，通过 `shineo auth login` 或 CI 令牌完成。

## 项目流程

Shineo 只支持源码项目。第三方 Agent 可以直接修改本地源码；用 `shineo project status` 检查差异，用 `shineo project push` 提交源码，用 `shineo project build` 请求 Shineo 服务端构建并读取诊断，用 `shineo project deploy` 完成同步、构建和发布。

CLI 不创建本地 VFS、`.shineo/build`、编译缓存或 Agent 适配器，也不会因为部署而自动注入 `/.shineo/apisdk`。`.shineo.json` 是 CLI 保留配置；其他 `.shineo/` 文件属于项目源码时，按项目实际契约处理并可随 SOURCE 项目同步。不要凭空创建或覆盖 SDK、数据库类型和运行时文件。

## 工作规则

1. 开始修改前确认当前 revision 和工作区权限。没有 `.shineo.json` 时，先执行 `shineo project clone <projectId> <directory>`，或让用户提供项目 ID。
2. 推送前先执行 `shineo project status`。如果远端 revision 已变化，先执行 `shineo project pull`，检查本地改动后再推送，不能强行覆盖远端。
3. 发布前必须让 `shineo project build` 成功，并检查构建诊断；发布使用 `shineo project deploy`，不要绕过服务端发布审核、权限、额度和 CMS binding 校验。
4. 需要机器可读结果时使用根级 `--json`，stdout 只保留结果；进度、诊断和错误在 stderr。脚本和 CI 根据退出码判断成功，不要解析人类可读文案。
5. 删除 CMS、表、字段、记录、媒体或权限前，先确认目标和用户意图；优先使用查询命令获得 ID，再执行修改命令。

## 平台能力

按需使用下列命令，不要自行实现对应的 HTTP、数据库或存储逻辑：

- `shineo skill list|show|resource` 获取 Shineo 内置技能和资源，结果直接输出，不安装到本地目录。
- `shineo dataApiSdk init [--overwrite]` 初始化前端页面使用的 Shineo 数据 API SDK 源文件；它不是数据表、字段或 CMS 初始化，不会把 SDK 注入构建产物。
- `shineo design init|fonts|lint|export` 管理项目设计文档和设计令牌。
- `shineo cms list|create|view|update|delete|access|bind|unbind` 管理 CMS 实例和项目绑定。
- `shineo data tables|fields|records|permissions|folders|indexes|health|import|export` 管理云数据结构、记录和权限。
- `shineo media list|view|upload|import|move|update|delete|folders` 管理 CMS 媒体和文件夹。

这些命令通过 Shineo 现有 Tool Gateway 或领域接口执行，权限、schema、幂等和服务端错误以返回结果为准。需要完整参数或工具 schema 时，先执行 `shineo tool list`；需要调用尚未封装的只读或平台工具时，使用 `shineo tool call <toolName> --input <json>`，并按要求附加 `--project`。

具体命令映射、项目流程、平台工具和上传限制见：

- [命令参考](references/commands.md)
- [项目流程](references/project-workflows.md)
- [平台工具](references/platform-tools.md)
