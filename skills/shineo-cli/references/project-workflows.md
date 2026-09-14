# Shineo 项目工作流程

## 源码项目

SOURCE 项目保存可被网页端编辑器、Shineo Agent 和第三方本地 Agent 修改的源码。源码目录保持普通工程结构，Agent 可以使用项目已有的 npm、pnpm、yarn、Vite 或测试脚本；CLI 不替代这些本地工具。

推荐流程：

```text
shineo auth login
shineo project clone <projectId> .
# 第三方 Agent 修改本地源码并运行项目自己的检查
shineo project status
shineo project push -m "更新项目"
shineo project build
shineo project deploy
```

`project push` 会读取当前目录源码，与远端 manifest 按内容哈希比较，只提交新增、修改和删除的文件，并更新 `.shineo.json` 中的 `revisionId`。`.shineo.json` 本身不会作为源码提交。

服务端以 revision 的 head 做乐观并发控制。push 返回冲突时，先保存或审查本地改动，再执行 `shineo project pull`，解决差异后重新执行 `status` 和 `push`。不要删除本地文件来规避冲突，也不要重复重试同一个过期 revision。

`project build` 触发 Shineo 服务端源码构建并返回诊断。它用于验证 Shineo 的正式构建链路；本地 Vite、TypeScript、测试和开发服务器仍由项目自己的 package scripts 管理。`project deploy` 会重新同步源码、等待构建结束、生成 release bundle，再进入正式发布流程。

## 文件边界

- `.shineo.json` 是 CLI 绑定配置，不应让 Agent 改写 `projectId` 或 `workspaceId` 来绕过服务端权限。
- SOURCE 项目中的其他 `.shineo/` 文件可能是项目运行时源码的一部分，CLI 会按普通项目文件同步；不要假设 CLI 会生成或注入它们。
- `/.shineo/apisdk`、数据库类型和认证模板由 Shineo 项目契约定义。需要改变它们时，先读取当前项目和服务端工具结果，不要自行猜测 SDK API，也不要静默覆盖用户文件。
