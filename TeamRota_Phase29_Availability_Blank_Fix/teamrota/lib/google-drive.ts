import { createAdminClient } from "@/lib/supabase/admin";

type ArchiveInput = {
  entityType: "leave_document" | "timesheet" | "payroll_timesheet" | "backup";
  entityId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  year?: number | null;
  month?: number | null;
  fileName: string;
  mimeType: string;
  data: ArrayBuffer | Uint8Array | Buffer | string;
  folders: string[];
  metadata?: Record<string, unknown>;
  archivedBy?: string | null;
};

export function googleDriveConfiguration() {
  const required = [
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_DRIVE_REFRESH_TOKEN",
  ];
  const missing = required.filter((key) => !String(process.env[key] || "").trim());
  return {
    configured: missing.length === 0,
    missing,
    rootFolderId: String(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "root").trim() || "root",
    account: String(process.env.GOOGLE_DRIVE_ACCOUNT_EMAIL || "miranenergyrotaplan@gmail.com").trim(),
  };
}

async function accessToken() {
  const cfg = googleDriveConfiguration();
  if (!cfg.configured) throw new Error(`Google Drive is not configured. Missing: ${cfg.missing.join(", ")}`);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: String(process.env.GOOGLE_DRIVE_CLIENT_ID),
      client_secret: String(process.env.GOOGLE_DRIVE_CLIENT_SECRET),
      refresh_token: String(process.env.GOOGLE_DRIVE_REFRESH_TOKEN),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `Unable to obtain Google access token (${response.status}).`);
  }
  return String(body.access_token);
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateFolder(token: string, parentId: string, name: string) {
  const q = `'${escapeQuery(parentId)}' in parents and name='${escapeQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const listed = await list.json().catch(() => ({}));
  if (!list.ok) throw new Error(listed.error?.message || "Unable to search Google Drive folders.");
  if (listed.files?.[0]?.id) return String(listed.files[0].id);

  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
    cache: "no-store",
  });
  const created = await create.json().catch(() => ({}));
  if (!create.ok || !created.id) throw new Error(created.error?.message || `Unable to create Google Drive folder: ${name}`);
  return String(created.id);
}

async function ensureFolderPath(token: string, folders: string[]) {
  let parent = googleDriveConfiguration().rootFolderId;
  for (const folder of folders.filter(Boolean)) parent = await findOrCreateFolder(token, parent, folder);
  return parent;
}

function bytes(value: ArchiveInput["data"]) {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value);
}

async function uploadMultipart(token: string, parentId: string, fileName: string, mimeType: string, data: ArchiveInput["data"]) {
  const boundary = `teamrota_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });
  const content = bytes(data);
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(prefix.length + content.length + suffix.length);
  body.set(prefix, 0); body.set(content, prefix.length); body.set(suffix, prefix.length + content.length);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) throw new Error(result.error?.message || `Google Drive upload failed (${response.status}).`);
  return result;
}

export async function archiveToGoogleDrive(input: ArchiveInput) {
  const admin = createAdminClient();
  const cfg = googleDriveConfiguration();
  if (!cfg.configured) {
    const error = `Google Drive archive skipped. Missing: ${cfg.missing.join(", ")}`;
    await admin.from("document_archives").insert({
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      employee_id: input.employeeId || null,
      file_name: input.fileName,
      mime_type: input.mimeType,
      provider: "google_drive",
      archive_status: "skipped",
      error_message: error,
      metadata: input.metadata || {},
      archived_by: input.archivedBy || null,
    });
    return { status: "skipped" as const, error, fileId: null };
  }

  try {
    const token = await accessToken();
    const folderId = await ensureFolderPath(token, input.folders);
    const uploaded = await uploadMultipart(token, folderId, input.fileName, input.mimeType, input.data);
    await admin.from("document_archives").insert({
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      employee_id: input.employeeId || null,
      archive_year: input.year || null,
      archive_month: input.month || null,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size_bytes: uploaded.size ? Number(uploaded.size) : null,
      provider: "google_drive",
      provider_file_id: uploaded.id,
      provider_folder_id: folderId,
      provider_web_url: uploaded.webViewLink || null,
      archive_status: "archived",
      metadata: input.metadata || {},
      archived_by: input.archivedBy || null,
      archived_at: new Date().toISOString(),
    });
    return { status: "archived" as const, error: null, fileId: String(uploaded.id), webViewLink: uploaded.webViewLink || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Google Drive archive failure.";
    await admin.from("document_archives").insert({
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      employee_id: input.employeeId || null,
      archive_year: input.year || null,
      archive_month: input.month || null,
      file_name: input.fileName,
      mime_type: input.mimeType,
      provider: "google_drive",
      archive_status: "failed",
      error_message: message,
      metadata: input.metadata || {},
      archived_by: input.archivedBy || null,
    });
    return { status: "failed" as const, error: message, fileId: null };
  }
}

export async function archiveSupabaseObject(args: {
  bucket: string;
  path: string;
  fileName: string;
  mimeType: string;
  entityType: ArchiveInput["entityType"];
  entityId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  year?: number | null;
  folders: string[];
  archivedBy?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(args.bucket).download(args.path);
  if (error || !data) throw new Error(error?.message || "Unable to download the source file from Supabase Storage.");
  return archiveToGoogleDrive({ ...args, data: await data.arrayBuffer() });
}
