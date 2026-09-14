# Shineo CLI

[Shineo](https://shineo.app) 的跨平台命令行入口。项目源码保持普通目录结构，CLI 只在项目根目录保存 `.shineo.json` 项目绑定配置。

本仓库同时提供面向 Claude Code、Codex、Trae、WorkBuddy 等 Agent 的配套 Skill，位于 `skills/shineo-cli/`，会随 npm 包一起发布。它描述源码同步、服务端构建发布，以及 Design、CMS、云数据和媒体能力。

```powershell
npm install -g @shineo/cli
shineo auth login --token "$env:SHINEO_TOKEN"
shineo project clone <project-id> .
```

`shineo skill show <name>` 会直接输出服务端 Skill 工具返回的内容，不会在本地安装 Skill。第三方 Agent 可以直接操作当前项目目录。

项目源码由网页端编辑器、Shineo Agent 或第三方 Agent 修改。同步后使用 `shineo project build` 触发 Shineo 服务端构建，确认诊断通过后使用 `shineo project deploy` 发布。CLI 不创建 `.shineo/build`、本地 VFS 或编译缓存。

前端页面需要调用 Shineo 数据 API 时，在已绑定的源码项目根目录执行 `shineo dataApiSdk init`。它只初始化项目源码中的 `/.shineo/apisdk/*` 文件，供前端代码导入使用；不会创建数据表、字段，不是 CMS 或云数据初始化，也不会把 SDK 强制注入构建产物。已有文件默认保留，需要重置时显式使用 `shineo dataApiSdk init --overwrite`。

平台能力命令直接调用 Shineo 现有工具和接口：

```powershell
shineo data tables list --cms <cms-id>
shineo data records list --cms <cms-id> --input '{"tableId":"<table-id>","limit":20}'
shineo data records create --cms <cms-id> --input '{"tableId":"<table-id>","values":{"name":"Demo"}}'
shineo data fields list <table-id> --cms <cms-id>
shineo data permissions get --cms <cms-id>
shineo design fonts --input '{"query":"sans","limit":10}'
shineo design lint
shineo design export --format css-tailwind
shineo media upload .\public\logo.png --cms <cms-id>
```

数据表和设计命令要求当前目录存在 `.shineo.json`；`--cms` 使用当前项目已接入且当前账号有权限的 CMS ID。所有命令均支持根级 `--json`，结构化结果写入 stdout，调试信息写入 stderr。
