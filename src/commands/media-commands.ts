import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ApiClient } from "../api/api-client.js";
import { OutputWriter } from "../output/output-writer.js";

export async function listMedia(api: ApiClient, output: OutputWriter, cmsId: string, inputJson?: string): Promise<void> {
  output.result(await api.get(`/cms/${encodeURIComponent(cmsId)}/media/assets${querySuffix(inputJson)}`));
}

export async function viewMedia(api: ApiClient, output: OutputWriter, cmsId: string, assetId: string): Promise<void> {
  output.result(await api.get(`/cms/${encodeURIComponent(cmsId)}/media/assets/${encodeURIComponent(assetId)}`));
}

export async function deleteMedia(api: ApiClient, output: OutputWriter, cmsId: string, assetId: string, inputJson?: string): Promise<void> {
  output.result(await api.delete(`/cms/${encodeURIComponent(cmsId)}/media/assets/${encodeURIComponent(assetId)}${querySuffix(inputJson)}`));
}

export async function mediaAction(api: ApiClient, output: OutputWriter, method: "post" | "patch", cmsId: string, resource: string, inputJson: string): Promise<void> {
  const input = parseObject(inputJson);
  output.result(method === "post"
    ? await api.post(`/cms/${encodeURIComponent(cmsId)}/media/${resource}`, input)
    : await api.patch(`/cms/${encodeURIComponent(cmsId)}/media/${resource}`, input));
}

export async function importMedia(api: ApiClient, output: OutputWriter, cmsId: string, inputJson: string): Promise<void> {
  output.result(await api.postWithHeaders(
    `/cms/${encodeURIComponent(cmsId)}/media/imports`,
    parseObject(inputJson),
    { "Idempotency-Key": randomUUID() },
  ));
}

export async function uploadMedia(api: ApiClient, output: OutputWriter, cmsId: string, filePath: string, folderId?: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const contents = await fs.readFile(absolutePath);
  const fileName = path.basename(absolutePath);
  const contentType = mimeTypeFor(fileName);
  const sha256 = createHash("sha256").update(contents).digest("hex");
  const reservation = await api.postWithHeaders(
    `/cms/${encodeURIComponent(cmsId)}/media/uploads`,
    { fileName, sizeBytes: contents.byteLength, contentType, sha256, ...(folderId ? { folderId } : {}) },
    { "Idempotency-Key": randomUUID() },
  ) as { operationId: string; reservationId: string; upload?: { url: string; method: "POST"; fileField: string; fields: Record<string, string>; headers: Record<string, string> } };
  if (!reservation.upload) throw new Error("服务端未返回媒体上传地址。");
  const form = new FormData();
  for (const [key, value] of Object.entries(reservation.upload.fields)) form.append(key, value);
  form.append(reservation.upload.fileField, new Blob([new Uint8Array(contents)], { type: contentType }), fileName);
  const uploadResponse = await fetch(reservation.upload.url, { method: reservation.upload.method, headers: reservation.upload.headers, body: form });
  if (!uploadResponse.ok) throw new Error(`上传媒体失败：HTTP ${uploadResponse.status}`);
  const uploadText = await uploadResponse.text();
  let uploadResult: unknown = undefined;
  if (uploadText) {
    try { uploadResult = JSON.parse(uploadText); } catch { uploadResult = undefined; }
  }
  output.result(await api.post(`/cms/${encodeURIComponent(cmsId)}/media/uploads/${encodeURIComponent(reservation.operationId)}/complete`, {
    reservationId: reservation.reservationId,
    ...(uploadResult && typeof uploadResult === "object" ? { uploadResult } : {}),
  }));
}

function querySuffix(inputJson?: string): string {
  if (!inputJson) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parseObject(inputJson))) {
    if (value === undefined || value === null) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function parseObject(value: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch (error) {
    throw new Error(`JSON 参数无效：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON 参数必须是对象。");
  return parsed as Record<string, unknown>;
}

function mimeTypeFor(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  return ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".pdf": "application/pdf" } as Record<string, string>)[extension] ?? "application/octet-stream";
}
