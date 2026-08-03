"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageWorkforce } from "@/lib/access-control";

async function requireHolidayManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("id,app_role,job_title").eq("id", user.id).single();
  if (!data || !canManageWorkforce(data)) throw new Error("HR or Administrator access is required.");
  return data;
}

function value(formData: FormData, key: string) { return String(formData.get(key) || "").trim(); }
function dates(startText: string, endText: string) {
  const start = new Date(`${startText}T00:00:00Z`);
  const end = new Date(`${endText}T00:00:00Z`);
  if (!startText || !endText || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Valid start and end dates are required.");
  if (end < start) throw new Error("Holiday end date cannot be before its start date.");
  const maxDays = 366;
  const result: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    result.push(d.toISOString().slice(0, 10));
    if (result.length > maxDays) throw new Error("A holiday period cannot exceed 366 calendar days.");
  }
  return result;
}

function scopedFields(formData: FormData) {
  const type = value(formData, "holiday_type") || "public";
  return {
    holiday_type: type,
    department_id: type === "department" ? value(formData, "department_id") || null : null,
    office_location: type === "location" ? value(formData, "office_location") || null : null,
  };
}

function refresh() {
  revalidatePath("/holidays");
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  revalidatePath("/timesheets");
  revalidatePath("/dashboard");
}

export async function createHoliday(formData: FormData) {
  const actor = await requireHolidayManager();
  const admin = createAdminClient();
  const startDate = value(formData, "start_date");
  const endDate = value(formData, "end_date") || startDate;
  const allDates = dates(startDate, endDate);
  const seriesId = crypto.randomUUID();
  const scope = scopedFields(formData);
  const name = value(formData, "name");
  if (!name) throw new Error("Holiday name is required.");
  const rows = allDates.map((holidayDate) => ({
    series_id: seriesId,
    name,
    holiday_date: holidayDate,
    ...scope,
    paid: value(formData, "paid") !== "false",
    recurring_annually: value(formData, "recurring_annually") === "true",
    notes: value(formData, "notes") || null,
    active: true,
    created_by: actor.id,
  }));
  const { error } = await admin.from("holidays").insert(rows);
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateHoliday(formData: FormData) {
  const actor = await requireHolidayManager();
  const admin = createAdminClient();
  const seriesId = value(formData, "series_id");
  if (!seriesId) throw new Error("Holiday series was not found.");
  const startDate = value(formData, "start_date");
  const endDate = value(formData, "end_date") || startDate;
  const allDates = dates(startDate, endDate);
  const scope = scopedFields(formData);
  const name = value(formData, "name");
  if (!name) throw new Error("Holiday name is required.");
  const { data: existing, error: readError } = await admin.from("holidays").select("active,created_at,created_by").eq("series_id", seriesId).limit(1).maybeSingle();
  if (readError || !existing) throw new Error(readError?.message || "Holiday series was not found.");
  const { error: deleteError } = await admin.from("holidays").delete().eq("series_id", seriesId);
  if (deleteError) throw new Error(deleteError.message);
  const rows = allDates.map((holidayDate) => ({
    series_id: seriesId,
    name,
    holiday_date: holidayDate,
    ...scope,
    paid: value(formData, "paid") !== "false",
    recurring_annually: value(formData, "recurring_annually") === "true",
    notes: value(formData, "notes") || null,
    active: existing.active,
    created_at: existing.created_at,
    created_by: existing.created_by || actor.id,
    updated_at: new Date().toISOString(),
    updated_by: actor.id,
  }));
  const { error } = await admin.from("holidays").insert(rows);
  if (error) throw new Error(error.message);
  refresh();
}

export async function toggleHoliday(formData: FormData) {
  const actor = await requireHolidayManager();
  const admin = createAdminClient();
  const { error } = await admin.from("holidays").update({ active: value(formData, "active") === "true", updated_at: new Date().toISOString(), updated_by: actor.id }).eq("series_id", value(formData, "series_id"));
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteHoliday(formData: FormData) {
  await requireHolidayManager();
  const admin = createAdminClient();
  const seriesId = value(formData, "series_id");
  const confirmation = value(formData, "confirmation");
  if (confirmation !== "DELETE") throw new Error('Type DELETE to permanently remove the holiday.');
  const { error } = await admin.from("holidays").delete().eq("series_id", seriesId);
  if (error) throw new Error(error.message);
  refresh();
}
