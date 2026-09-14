# Shineo 平台工具

CLI 将平台能力转成命令行参数，但执行仍由 Shineo 服务端负责。参数校验、权限、CMS binding、数据保护和错误码以服务端 Tool Gateway 返回为准。

## 技能

```text
shineo skill list
shineo skill show <skillName>
shineo skill resource <skillName> <resourcePath>
```

技能结果直接输出到 stdout，不安装到项目目录。读取技能后再按其适用范围处理 UI、数据库或其他专项任务；不要把技能内容复制成项目中的隐式配置。

## Design

`design_init` 初始化项目的 `DESIGN.md`，默认不覆盖已有文档；`design_fonts` 查询字体目录；`design_lint` 返回设计文档问题；`design_export` 将设计文档中的 token 导出为 Tailwind、Tailwind v4 CSS 或 DTCG。设计命令需要项目上下文，修改结果会关联项目 revision。

```text
shineo design init
shineo design fonts --input '{"query":"sans","limit":10}'
shineo design lint
shineo design export --format css-tailwind
```

## 前端数据 SDK

`shineo dataApiSdk init` 用于初始化前端页面对接 Shineo 数据 API 的源码 SDK。命令会调用服务端 `database_init` 工具，并把返回的 `/.shineo/apisdk/index.ts`、`version.ts`、`auth.ts` 和 `database.types.ts` 写入当前源码项目。

```text
shineo dataApiSdk init
shineo dataApiSdk init --overwrite
```

它只生成前端 API 接入文件，不创建数据表或字段，不管理 CMS，也不会把 SDK 注入构建产物。默认保留本地已有文件；只有明确传入 `--overwrite` 才覆盖。

## CMS 和云数据

项目 CMS 绑定通过 `cms bind`、`cms unbind` 管理。数据操作使用服务端的 `data_tables`、`data_fields`、`data_records`、`data_permissions` 工具，覆盖：

- 表的查询、创建、更新、复制和删除。
- 字段的查询、创建、更新、排序和删除。
- 记录的查询、读取、创建、更新、单元格更新、删除、批量、聚合、导入和导出。
- 公开访问、协作者、角色、记录权限和字段权限。
- 表文件夹、索引和 CMS 健康检查。

示例：

```text
shineo data tables list --cms <cmsId>
shineo data fields list <tableId> --cms <cmsId>
shineo data records list --cms <cmsId> --input '{"tableId":"<tableId>","limit":20}'
shineo data records create --cms <cmsId> --input '{"tableId":"<tableId>","values":{"name":"Demo"}}'
shineo data permissions get --cms <cmsId>
```

修改 schema、权限、记录和删除数据前要检查当前 CMS、目标 ID 和用户意图。不要把 CMS ID、表 ID 或字段 ID 当作名称猜测。

## Media

媒体上传先由服务端预留配额并返回上传指令，CLI 上传文件后再调用 complete；媒体导入使用 URL 和幂等键。支持资产查询、查看、上传、URL 导入、移动、更新、删除以及文件夹管理。

```text
shineo media list --cms <cmsId>
shineo media upload ./public/logo.png --cms <cmsId>
shineo media import --cms <cmsId> --input '{"urls":["https://example.com/logo.png"]}'
```

不要自行上传到对象存储，也不要把预签名 URL 保存进源码。上传大小和媒体配额由服务端控制。

## 原始工具调用

`shineo tool list` 返回当前 Gateway 允许的工具名、描述、输入 schema 和是否需要项目上下文。`shineo tool call` 适合调用 CLI 尚未提供专用友好命令的工具，但仍必须遵守返回的 schema：

```text
shineo tool list --json
shineo tool call <toolName> --input '<json>' --project
```

不要使用依赖浏览器 Bridge、本地 VFS 读写或未出现在工具目录中的 Agent 工具。CLI 的平台调用只负责传递上下文和结果，不绕过服务端权限。
