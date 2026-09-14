#!/usr/bin/env node
import { Command } from "commander";
import { ApiClient } from "./api/api-client.js";
import { listConfigProfiles, readConfig, readProjectConfig, useConfigProfile, writeConfig } from "./config/config-store.js";
import { loginInBrowser } from "./auth/browser-login.js";
import { OutputWriter } from "./output/output-writer.js";
import { buildProject, cloneProject, createProject, deploySourceProject, listProjects, projectStatus, pullProject, pushProject } from "./commands/project-commands.js";
import { cmsAction, listCms } from "./commands/cms-commands.js";
import { executeDesignTool, executeSkill, executeTool, listTools } from "./commands/tool-commands.js";
import { executeDataApi, executeDataTool, initializeDataApiSdk, listFields } from "./commands/data-commands.js";
import { deleteMedia, importMedia, listMedia, mediaAction, uploadMedia, viewMedia } from "./commands/media-commands.js";

const program = new Command();
program.name("shineo").description("Shineo 平台命令行工具").version("0.1.2");
program.option("--json", "输出 JSON").option("--verbose", "输出请求调试信息").option("--language <language>", "输出语言", "zh-CN").option("--host <url>", "覆盖 API 地址").option("--profile <name>", "使用 API 配置 profile");

const auth = program.command("auth");
auth.command("status").action(async () => {
  const config = await readConfig(program.opts().profile);
  new OutputWriter({ json: program.opts().json }).result({ profile: config.profile, apiUrl: config.apiUrl, authenticated: Boolean(config.accessToken) });
});
auth.command("logout").action(async () => {
  const config = await readConfig(program.opts().profile);
  const nextConfig = { apiUrl: config.apiUrl, profile: config.profile } as import("./config/config-store.js").ShineoConfig;
  if (config.language) nextConfig.language = config.language;
  await writeConfig(nextConfig, config.profile);
  new OutputWriter({ json: program.opts().json }).result({ loggedOut: true, profile: config.profile });
});
auth.command("login").option("--token <token>", "Shineo 访问令牌").option("--provider <provider>", "OAuth 登录提供商").option("--profile <name>", "保存到 API 配置 profile").action(async (options) => {
  const profile = options.profile ?? program.opts().profile;
  const config = await readConfig(profile);
  const nextApiUrl = program.opts().host ? program.opts().host as string : config.apiUrl;
  const nextConfig = { ...config, apiUrl: nextApiUrl, ...(profile ? { profile } : {}) };
  if (options.token) {
    nextConfig.accessToken = options.token;
  } else {
    await loginInBrowser(await ApiClient.create({ apiUrl: nextApiUrl, ...(profile ? { profile } : {}) }), nextConfig, options.provider, profile);
  }
  if (options.token) await writeConfig(nextConfig, profile);
  new OutputWriter({ json: program.opts().json }).result({ loggedIn: true, profile: nextConfig.profile });
});

const configCommand = program.command("config");
configCommand.command("list").action(async () => runConfig((output) => listConfigProfiles().then(output.result.bind(output))));
configCommand.command("get").action(async () => runConfig(async (output) => {
  const config = await readConfig(program.opts().profile);
  output.result({ profile: config.profile, apiUrl: config.apiUrl, authenticated: Boolean(config.accessToken), language: config.language ?? null });
}));
configCommand.command("use").argument("<profile>").action(async (profile) => runConfig(async (output) => {
  const config = await useConfigProfile(profile);
  output.result({ profile: config.profile, apiUrl: config.apiUrl, authenticated: Boolean(config.accessToken) });
}));
configCommand.command("set").argument("<key>").argument("<value>").action(async (key, value) => runConfig(async (output) => {
  if (key !== "api-url") throw new Error("目前只支持设置 api-url。");
  const config = await readConfig(program.opts().profile);
  await writeConfig({ ...config, apiUrl: value }, config.profile);
  output.result({ profile: config.profile, apiUrl: value });
}));

const workspace = program.command("workspace");
workspace.command("list").action(async () => run((api, output) => api.get("/user/workspaces").then(output.result.bind(output))));
workspace.command("view").argument("<workspaceId>").action(async (workspaceId) => run(async (api, output) => {
  const workspaces = await api.get<Array<Record<string, unknown>>>("/user/workspaces");
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error(`工作区不存在或当前账号无权访问：${workspaceId}`);
  output.result(workspace);
}));
workspace.command("use").argument("<workspaceId>").action(async (workspaceId) => run((api, output) => api.patch("/user/workspaces/current", { workspaceId }).then(output.result.bind(output))));
workspace.command("members").argument("<workspaceId>").action(async (workspaceId) => run((api, output) => api.get(`/workspaces/${encodeURIComponent(workspaceId)}/members`).then(output.result.bind(output))));

const project = program.command("project");
project.command("list").option("--workspace <id>").action(async (options) => run((api, output) => listProjects(api, output, options.workspace)));
project.command("create").requiredOption("--workspace <id>").requiredOption("--name <name>").option("--type <type>", "项目类型", "default").action(async (options) => run((api, output) => createProject(api, output, { workspaceId: options.workspace, name: options.name, projectType: options.type })));
project.command("clone").argument("<projectId>").argument("[directory]", ".").action(async (projectId, directory) => run((api, output) => cloneProject(api, output, projectId, directory)));
project.command("pull").action(async () => run((api, output) => pullProject(api, output)));
project.command("push").option("-m, --message <message>", "提交说明", "Update from Shineo CLI").action(async (options) => run((api, output) => pushProject(api, output, options.message)));
project.command("status").action(async () => run((api, output) => projectStatus(api, output)));
project.command("build").action(async () => run((api, output) => buildProject(api, output)));
project.command("deploy").action(async () => run((api, output) => deploySourceProject(api, output)));
project.command("revisions").action(async () => run(async (api, output) => {
  const config = await readProjectConfig();
  output.result(await api.get(`/projects/${encodeURIComponent(config.projectId)}/revisions`));
}));

const skill = program.command("skill");
skill.command("list").action(async () => run((api, output) => executeSkill(api, output, "list")));
skill.command("show").argument("<name>").action(async (name) => run((api, output) => executeSkill(api, output, "show", name)));
skill.command("resource").argument("<name>").argument("<path>").action(async (name, resourcePath) => run((api, output) => executeSkill(api, output, "resource", name, resourcePath)));

const dataApiSdk = program.command("dataApiSdk");
dataApiSdk.command("init").option("--overwrite", "覆盖本地已有 SDK 文件").action(async (options) => run((api, output) => initializeDataApiSdk(api, output, Boolean(options.overwrite))));

const design = program.command("design");
design.command("init").option("--overwrite").action(async (options) => run((api, output) => executeDesignTool(api, output, "design_init", JSON.stringify({ overwrite: Boolean(options.overwrite) }))));
design.command("fonts").option("--input <json>", "筛选条件 JSON").action(async (options) => run((api, output) => executeDesignTool(api, output, "design_fonts", options.input)));
design.command("lint").action(async () => run((api, output) => executeDesignTool(api, output, "design_lint")));
design.command("export").option("--format <format>", "tailwind|tailwind-v4|css-tailwind|dtcg", "tailwind").option("--target <target>", "tailwindV3|tailwindV4").action(async (options) => run((api, output) => executeDesignTool(api, output, "design_export", JSON.stringify({ format: options.format, ...(options.target ? { target: options.target } : {}) }))));

const cms = program.command("cms");
cms.command("list").option("--workspace <id>").action(async (options) => run((api, output) => listCms(api, output, options.workspace)));
for (const action of ["view", "delete", "update", "access"]) {
  cms.command(action).argument("<cmsId>").argument("[json]").action(async (cmsId, value) => run((api, output) => cmsAction(api, output, action, cmsId, value)));
}
cms.command("create").requiredOption("--workspace <workspaceId>").requiredOption("--name <name>").option("--description <description>").action(async (options) => run((api, output) => api.post(`/workspaces/${encodeURIComponent(options.workspace)}/cms`, { name: options.name, ...(options.description ? { description: options.description } : {}) }).then(output.result.bind(output))));
cms.command("bind").argument("<cmsId>").action(async (cmsId) => run(async (api, output) => {
  const config = await readProjectConfig();
  output.result(await api.post(`/projects/${encodeURIComponent(config.projectId)}/cms-bindings`, { cmsId }));
}));
cms.command("unbind").argument("<cmsId>").action(async (cmsId) => run(async (api, output) => {
  const config = await readProjectConfig();
  output.result(await api.delete(`/projects/${encodeURIComponent(config.projectId)}/cms-bindings/${encodeURIComponent(cmsId)}`));
}));

const data = program.command("data");
const tables = data.command("tables");
tables.command("list").requiredOption("--cms <cmsId>").action(async (options) => run((api, output) => executeDataTool(api, output, "data_tables", "list", options.cms)));
tables.command("get").argument("<tableId>").requiredOption("--cms <cmsId>").action(async (tableId, options) => run((api, output) => executeDataTool(api, output, "data_tables", "get", options.cms, undefined, { tableId })));
tables.command("create").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => executeDataTool(api, output, "data_tables", "create", options.cms, options.input)));
tables.command("update").argument("<tableId>").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (tableId, options) => run((api, output) => executeDataTool(api, output, "data_tables", "update", options.cms, options.input, { tableId })));
tables.command("duplicate").argument("<tableId>").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (tableId, options) => run((api, output) => executeDataTool(api, output, "data_tables", "duplicate", options.cms, options.input, { tableId })));
tables.command("delete").argument("<tableId>").requiredOption("--cms <cmsId>").action(async (tableId, options) => run((api, output) => executeDataTool(api, output, "data_tables", "delete", options.cms, undefined, { tableId })));

const fields = data.command("fields");
fields.command("list").argument("<tableId>").requiredOption("--cms <cmsId>").action(async (tableId, options) => run((api, output) => listFields(api, output, options.cms, tableId)));
fields.command("create").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => executeDataTool(api, output, "data_fields", "create", options.cms, options.input)));
fields.command("update").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => executeDataTool(api, output, "data_fields", "update", options.cms, options.input)));
fields.command("reorder").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => executeDataTool(api, output, "data_fields", "reorder", options.cms, options.input)));
fields.command("delete").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => executeDataTool(api, output, "data_fields", "delete", options.cms, options.input)));

const records = data.command("records");
for (const action of ["list", "get", "create", "update", "set_cell", "delete", "aggregate", "bulk", "import", "export"]) {
  const command = records.command(action).requiredOption("--cms <cmsId>");
  if (["get", "delete"].includes(action)) command.argument("<recordId>");
  if (!["get", "delete"].includes(action)) command.option("--input <json>", "工具输入 JSON");
  command.action(async (...args: unknown[]) => {
    const options = args.at(-1) as { cms: string; input: string };
    const recordId = args.length > 1 ? args[0] : undefined;
    await run((api, output) => executeDataTool(api, output, "data_records", action, options.cms, options.input, recordId ? { recordId } : {}));
  });
}

const permissions = data.command("permissions");
for (const action of ["get", "collaborators", "set_public", "upsert_role", "delete_role", "set_record", "set_field"]) {
  permissions.command(action).requiredOption("--cms <cmsId>").option("--input <json>").action(async (options) => run((api, output) => executeDataTool(api, output, "data_permissions", action, options.cms, options.input)));
}

const folders = data.command("folders");
folders.command("list").requiredOption("--cms <cmsId>").action(async (options) => run((api, output) => executeDataApi(api, output, "get", `/cms/${encodeURIComponent(options.cms)}/table-folders`)));
folders.command("create").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => executeDataApi(api, output, "post", `/cms/${encodeURIComponent(options.cms)}/table-folders`, options.input)));
folders.command("update").argument("<folderId>").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (folderId, options) => run((api, output) => executeDataApi(api, output, "patch", `/cms/${encodeURIComponent(options.cms)}/table-folders/${encodeURIComponent(folderId)}`, options.input)));
folders.command("delete").argument("<folderId>").requiredOption("--cms <cmsId>").action(async (folderId, options) => run((api, output) => executeDataApi(api, output, "delete", `/cms/${encodeURIComponent(options.cms)}/table-folders/${encodeURIComponent(folderId)}`)));
const indexes = data.command("indexes");
indexes.command("list").argument("<tableId>").requiredOption("--cms <cmsId>").action(async (tableId, options) => run((api, output) => executeDataApi(api, output, "get", `/cms/${encodeURIComponent(options.cms)}/tables/${encodeURIComponent(tableId)}/indexes`)));
indexes.command("create").argument("<tableId>").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (tableId, options) => run((api, output) => executeDataApi(api, output, "post", `/cms/${encodeURIComponent(options.cms)}/tables/${encodeURIComponent(tableId)}/indexes`, options.input)));
indexes.command("delete").argument("<indexId>").requiredOption("--cms <cmsId>").action(async (indexId, options) => run((api, output) => executeDataApi(api, output, "delete", `/cms/${encodeURIComponent(options.cms)}/indexes/${encodeURIComponent(indexId)}`)));
data.command("health").argument("<cmsId>").action(async (cmsId) => run((api, output) => executeDataApi(api, output, "get", `/cms/${encodeURIComponent(cmsId)}/health`)));
data.command("import").argument("<tableId>").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (tableId, options) => run((api, output) => executeDataTool(api, output, "data_records", "import", options.cms, options.input, { tableId })));
data.command("export").argument("<tableId>").requiredOption("--cms <cmsId>").option("--input <json>").action(async (tableId, options) => run((api, output) => executeDataTool(api, output, "data_records", "export", options.cms, options.input, { tableId })));

const media = program.command("media");
media.command("list").requiredOption("--cms <cmsId>").option("--input <json>", "筛选条件 JSON").action(async (options) => run((api, output) => listMedia(api, output, options.cms, options.input)));
media.command("view").argument("<assetId>").requiredOption("--cms <cmsId>").action(async (assetId, options) => run((api, output) => viewMedia(api, output, options.cms, assetId)));
media.command("upload").argument("<file>").requiredOption("--cms <cmsId>").option("--folder <folderId>").action(async (file, options) => run((api, output) => uploadMedia(api, output, options.cms, file, options.folder)));
media.command("import").requiredOption("--cms <cmsId>").requiredOption("--input <json>", "例如 {\"urls\":[\"https://...\"]}").action(async (options) => run((api, output) => importMedia(api, output, options.cms, options.input)));
media.command("move").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => mediaAction(api, output, "post", options.cms, "assets/batch-move", options.input)));
media.command("update").argument("<assetId>").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (assetId, options) => run((api, output) => mediaAction(api, output, "patch", options.cms, `assets/${encodeURIComponent(assetId)}`, options.input)));
media.command("delete").argument("<assetId>").requiredOption("--cms <cmsId>").option("--input <json>", "删除选项 JSON").action(async (assetId, options) => run((api, output) => deleteMedia(api, output, options.cms, assetId, options.input)));
const mediaFolders = media.command("folders");
mediaFolders.command("list").requiredOption("--cms <cmsId>").action(async (options) => run((api, output) => executeDataApi(api, output, "get", `/cms/${encodeURIComponent(options.cms)}/media/folders`)));
mediaFolders.command("create").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (options) => run((api, output) => mediaAction(api, output, "post", options.cms, "folders", options.input)));
mediaFolders.command("update").argument("<folderId>").requiredOption("--cms <cmsId>").requiredOption("--input <json>").action(async (folderId, options) => run((api, output) => mediaAction(api, output, "patch", options.cms, `folders/${encodeURIComponent(folderId)}`, options.input)));
mediaFolders.command("delete").argument("<folderId>").requiredOption("--cms <cmsId>").action(async (folderId, options) => run((api, output) => executeDataApi(api, output, "delete", `/cms/${encodeURIComponent(options.cms)}/media/folders/${encodeURIComponent(folderId)}`)));

const tools = program.command("tool");
tools.command("list").action(async () => run((api, output) => listTools(api, output)));
tools.command("call").argument("<toolName>").requiredOption("--input <json>").option("--project").action(async (toolName, options) => run((api, output) => executeTool(api, output, toolName, options.input, options.project)));

async function run(action: (api: ApiClient, output: OutputWriter) => Promise<void>): Promise<void> {
  try {
    const options = program.opts();
    const output = new OutputWriter({ json: Boolean(options.json), language: options.language });
    const api = await ApiClient.create({ ...(options.host ? { apiUrl: options.host } : {}), ...(options.profile ? { profile: options.profile } : {}), verbose: Boolean(options.verbose) });
    await action(api, output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`shineo: ${message}\n`);
    process.exitCode = 1;
  }
}

async function runConfig(action: (output: OutputWriter) => Promise<void>): Promise<void> {
  try {
    const options = program.opts();
    await action(new OutputWriter({ json: Boolean(options.json), language: options.language }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`shineo: ${message}\n`);
    process.exitCode = 1;
  }
}

await program.parseAsync();
