"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageWorkforce } from "@/lib/access-control";

async function requireWorkforceAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("profiles")
    .select("app_role,job_title")
    .eq("id", user.id)
    .single();
  if (!canManageWorkforce(data)) {
    throw new Error("Administrator or HR access is required.");
  }
  return user;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function parseUtcDate(dateText: string) {
  return new Date(`${dateText}T00:00:00Z`);
}

function dateTextsBetween(startText: string, endText: string) {
  const start = parseUtcDate(startText);
  const end = parseUtcDate(endText);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Select a valid date range.");
  }
  const values: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (values.length > 366) throw new Error("A bulk history update is limited to 366 days at a time.");
  }
  return values;
}

async function activeEmployeeIds(admin: ReturnType<typeof createAdminClient>, selectedId: string) {
  if (selectedId) return [selectedId];
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("employment_status", "active");
  if (error) throw new Error(error.message);
  return (data || []).map((row: any) => row.id);
}

async function writeAudit(args: {
  actorId: string;
  action: string;
  employeeScope: string;
  startDate: string;
  endDate: string;
  statusCode?: string | null;
  affectedRows: number;
  note?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("rota_history_audit").insert({
    actor_id: args.actorId,
    action: args.action,
    employee_scope: args.employeeScope,
    start_date: args.startDate,
    end_date: args.endDate,
    status_code: args.statusCode || null,
    affected_rows: args.affectedRows,
    note: args.note || null,
  });
  if (error) console.error("Unable to record rota history audit:", error.message);
}

function revalidateRotaPages() {
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  revalidatePath("/timesheets");
  revalidatePath("/dashboard");
}


export async function installStandardRotationPatterns() {
  await requireWorkforceAdmin();
  const admin = createAdminClient();
  const patterns = [
    { name: "1 Week ON / 1 Week OFF", code: "7-7", rotation_type: "cyclic", days_on: 7, days_off: 7, default_shift_code: "D", description: "Seven working days followed by seven rest days" },
    { name: "2 Weeks ON / 2 Weeks OFF", code: "14-14", rotation_type: "cyclic", days_on: 14, days_off: 14, default_shift_code: "D", description: "Fourteen working days followed by fourteen rest days" },
    { name: "28 Days ON / 28 Days OFF", code: "28-28", rotation_type: "cyclic", days_on: 28, days_off: 28, default_shift_code: "D", description: "Twenty-eight working days followed by twenty-eight rest days" },
    { name: "6 Weeks ON / 2 Weeks OFF", code: "42-14", rotation_type: "cyclic", days_on: 42, days_off: 14, default_shift_code: "D", description: "Six working weeks followed by two rest weeks" },
    { name: "Full Time — Sunday to Thursday", code: "FULL-TIME", rotation_type: "office", days_on: 5, days_off: 2, default_shift_code: "D", description: "Sunday through Thursday working; Friday and Saturday weekend" },
  ];
  for (const pattern of patterns) {
    const { data: existing, error: findError } = await admin.from("rotation_patterns").select("id").eq("code", pattern.code).maybeSingle();
    if (findError) throw new Error(findError.message);
    if (existing?.id) {
      const { error } = await admin.from("rotation_patterns").update({ ...pattern, active: true, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("rotation_patterns").insert(pattern);
      if (error) throw new Error(error.message);
    }
  }
  revalidateRotaPages();
}

export async function createRotationPattern(formData: FormData) {
  await requireWorkforceAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("rotation_patterns").insert({
    name: value(formData, "name"),
    code: value(formData, "code") || null,
    rotation_type: value(formData, "rotation_type") || "cyclic",
    days_on: Number(value(formData, "days_on") || 0),
    days_off: Number(value(formData, "days_off") || 0),
    default_shift_code: value(formData, "default_shift_code") || "D",
    description: value(formData, "description") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/rota");
}

export async function assignRotation(formData: FormData) {
  await requireWorkforceAdmin();
  const admin = createAdminClient();
  const employeeId = value(formData, "employee_id");
  await admin.from("employee_rotations").update({ active: false }).eq("employee_id", employeeId).eq("active", true);
  const { error } = await admin.from("employee_rotations").insert({
    employee_id: employeeId,
    rotation_pattern_id: value(formData, "rotation_pattern_id"),
    effective_from: value(formData, "effective_from"),
    cycle_anchor_date: value(formData, "cycle_anchor_date"),
    start_status: value(formData, "start_status") || "ON",
    notes: value(formData, "notes") || null,
    active: true,
  });
  if (error) throw new Error(error.message);
  revalidateRotaPages();
}

export async function saveRotaAssignment(formData: FormData) {
  const user = await requireWorkforceAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("rota_assignments").upsert({
    employee_id: value(formData, "employee_id"),
    work_date: value(formData, "work_date"),
    status_code: value(formData, "status_code") || "D",
    shift_start: value(formData, "shift_start") || null,
    shift_end: value(formData, "shift_end") || null,
    note: value(formData, "note") || null,
    source: "manual",
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "employee_id,work_date" });
  if (error) throw new Error(error.message);
  revalidateRotaPages();
}

export async function saveBulkPastRota(formData: FormData) {
  const user = await requireWorkforceAdmin();
  const admin = createAdminClient();
  const selectedEmployeeId = value(formData, "employee_id");
  const startDate = value(formData, "start_date");
  const endDate = value(formData, "end_date");
  const statusCode = value(formData, "status_code") || "D";
  const note = value(formData, "note") || "Historical rota entry";
  const today = new Date().toISOString().slice(0, 10);

  if (!startDate || !endDate) throw new Error("Start date and end date are required.");
  if (startDate > today || endDate > today) throw new Error("Past-history dates cannot be in the future.");

  const dates = dateTextsBetween(startDate, endDate);
  const employeeIds = await activeEmployeeIds(admin, selectedEmployeeId);
  if (employeeIds.length === 0) throw new Error("No active employees are available.");

  const rows = employeeIds.flatMap((employeeId) =>
    dates.map((workDate) => ({
      employee_id: employeeId,
      work_date: workDate,
      status_code: statusCode,
      shift_start: value(formData, "shift_start") || null,
      shift_end: value(formData, "shift_end") || null,
      note,
      source: "bulk_history",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }))
  );

  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await admin
      .from("rota_assignments")
      .upsert(rows.slice(offset, offset + 500), { onConflict: "employee_id,work_date" });
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    actorId: user.id,
    action: "bulk_upsert",
    employeeScope: selectedEmployeeId || "all_active",
    startDate,
    endDate,
    statusCode,
    affectedRows: rows.length,
    note,
  });
  revalidateRotaPages();
}

export async function deletePastRotaHistory(formData: FormData) {
  const user = await requireWorkforceAdmin();
  const admin = createAdminClient();
  const selectedEmployeeId = value(formData, "employee_id");
  const startDate = value(formData, "start_date");
  const endDate = value(formData, "end_date");
  const today = new Date().toISOString().slice(0, 10);

  if (!startDate || !endDate) throw new Error("Start date and end date are required.");
  if (startDate > today || endDate > today) throw new Error("Only past or current rota history can be deleted.");
  dateTextsBetween(startDate, endDate);

  let query = admin
    .from("rota_assignments")
    .delete({ count: "exact" })
    .gte("work_date", startDate)
    .lte("work_date", endDate);
  if (selectedEmployeeId) query = query.eq("employee_id", selectedEmployeeId);
  const { error, count } = await query;
  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: user.id,
    action: "bulk_delete",
    employeeScope: selectedEmployeeId || "all_employees",
    startDate,
    endDate,
    affectedRows: Number(count || 0),
    note: value(formData, "reason") || "Historical rota records removed",
  });
  revalidateRotaPages();
}
