"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSystemEmail } from "@/lib/email";
import { canManageWorkforce } from "@/lib/access-control";
import { archiveSupabaseObject } from "@/lib/google-drive";
import {
  datesBetween,
  isoDate,
  isWorkingStatus,
  statusForDate,
} from "@/lib/rota-status";

const value = (formData: FormData, key: string) =>
  String(formData.get(key) || "").trim();

async function currentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id,full_name,email,gender,manager_id,department_id,office_location,leave_approver_id,app_role,job_title"
    )
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found.");
  return profile;
}

async function logMail(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
  event: string,
  email: string,
  result: any
) {
  try {
    await admin.from("leave_notification_log").insert({
      leave_request_id: requestId,
      event_type: event,
      recipient_email: email,
      delivery_status: result.status,
      provider_message_id: result.id,
      error_message: result.error,
    });
  } catch (error) {
    console.error("Unable to save leave email log:", error);
  }
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

async function calculateRequestedDays(args: {
  admin: ReturnType<typeof createAdminClient>;
  profile: any;
  leaveType: any;
  start: string;
  end: string;
}) {
  const { admin, profile, leaveType, start, end } = args;
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const allDates = datesBetween(startDate, endDate);

  if (leaveType.day_basis === "calendar") {
    return allDates.length;
  }

  const [assignmentsResult, holidaysResult, rotationsResult] =
    await Promise.all([
      admin
        .from("rota_assignments")
        .select("employee_id,work_date,status_code,note")
        .eq("employee_id", profile.id)
        .gte("work_date", start)
        .lte("work_date", end),
      admin
        .from("holidays")
        .select("name,holiday_date,department_id,office_location")
        .eq("active", true)
        .gte("holiday_date", start)
        .lte("holiday_date", end),
      admin
        .from("employee_rotations")
        .select(
          "employee_id,effective_from,effective_to,cycle_anchor_date,start_status,rotation_patterns(days_on,days_off,default_shift_code)"
        )
        .eq("employee_id", profile.id)
        .eq("active", true)
        .lte("effective_from", end),
    ]);

  return allDates.filter((date) => {
    const status = statusForDate({
      employee: profile,
      date,
      assignments: assignmentsResult.data || [],
      holidays: holidaysResult.data || [],
      leaves: [],
      rotations: rotationsResult.data || [],
    });
    return isWorkingStatus(status.code);
  }).length;
}

async function availableBalance(args: {
  admin: ReturnType<typeof createAdminClient>;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  referenceDate?: string;
}) {
  const { admin, employeeId, leaveTypeId, year, referenceDate } = args;
  const [balanceResult, pendingResult] = await Promise.all([
    admin
      .from("leave_balances")
      .select("entitled,used,adjustment,carried_forward,carried_forward_expires_on")
      .eq("employee_id", employeeId)
      .eq("leave_type_id", leaveTypeId)
      .eq("leave_year", year)
      .maybeSingle(),
    admin
      .from("leave_requests")
      .select("requested_days")
      .eq("employee_id", employeeId)
      .eq("leave_type_id", leaveTypeId)
      .eq("status", "pending")
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`),
  ]);

  const balance = balanceResult.data;
  if (!balance) return null;

  const pending = (pendingResult.data || []).reduce(
    (sum: number, row: any) => sum + Number(row.requested_days || 0),
    0
  );

  const entitlement = Number(balance.entitled || 0) + Number(balance.adjustment || 0);
  const carriedForward = Number(balance.carried_forward || 0);
  const expiry = balance.carried_forward_expires_on
    ? parseDate(balance.carried_forward_expires_on)
    : null;
  const checkDate = referenceDate ? parseDate(referenceDate) : new Date();

  let effectiveCarry = carriedForward;
  let effectiveUsed = Number(balance.used || 0);
  let effectivePending = pending;

  if (expiry && checkDate > expiry && carriedForward > 0) {
    const expiryText = balance.carried_forward_expires_on;
    const [approvedBeforeExpiry, pendingBeforeExpiry] = await Promise.all([
      admin
        .from("leave_requests")
        .select("requested_days")
        .eq("employee_id", employeeId)
        .eq("leave_type_id", leaveTypeId)
        .eq("status", "approved")
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", expiryText),
      admin
        .from("leave_requests")
        .select("requested_days")
        .eq("employee_id", employeeId)
        .eq("leave_type_id", leaveTypeId)
        .eq("status", "pending")
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", expiryText),
    ]);
    const preExpiryDemand = [...(approvedBeforeExpiry.data || []), ...(pendingBeforeExpiry.data || [])]
      .reduce((sum: number, row: any) => sum + Number(row.requested_days || 0), 0);
    const carryConsumed = Math.min(carriedForward, preExpiryDemand);
    effectiveCarry = 0;
    effectiveUsed = Math.max(0, effectiveUsed - carryConsumed);
    const preExpiryPendingTotal = (pendingBeforeExpiry.data || [])
      .reduce((sum: number, row: any) => sum + Number(row.requested_days || 0), 0);
    effectivePending = Math.max(0, pending - Math.min(preExpiryPendingTotal, Math.max(0, carriedForward - Math.min(carriedForward, Number(balance.used || 0)))));
  }

  const total = entitlement + effectiveCarry;
  return {
    total,
    used: effectiveUsed,
    pending: effectivePending,
    carriedForward: effectiveCarry,
    carriedForwardExpiresOn: balance.carried_forward_expires_on || null,
    available: total - effectiveUsed - effectivePending,
  };
}

async function submitLeaveInternal(formData: FormData) {
  const sessionProfile = await currentProfile();
  const admin = createAdminClient();
  const typeId = value(formData, "leave_type_id");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "id,full_name,email,gender,manager_id,department_id,office_location,leave_approver_id"
    )
    .eq("id", sessionProfile.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Employee profile was not found.");
  }

  const { data: leaveType } = await admin
    .from("leave_types")
    .select("*")
    .eq("id", typeId)
    .single();

  if (!leaveType) throw new Error("Leave type not found.");
  if (leaveType.code === "PH") {
    throw new Error(
      "Public holidays are managed by HR through the Holiday Calendar and cannot be requested as leave."
    );
  }
  if (
    leaveType.eligibility_gender &&
    leaveType.eligibility_gender !== profile.gender
  ) {
    throw new Error(
      `${leaveType.name} is available only to eligible ${leaveType.eligibility_gender} employees.`
    );
  }

  if (leaveType.code === "NB") {
    const { data: maternity } = await admin
      .from("leave_requests")
      .select("id,end_date,leave_types!inner(code)")
      .eq("employee_id", profile.id)
      .eq("status", "approved")
      .eq("leave_types.code", "MAT")
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!maternity) {
      throw new Error(
        "Nursing Break is available only after an approved Maternity Leave."
      );
    }
    const expiry = parseDate(maternity.end_date);
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    if (new Date() > expiry) {
      throw new Error(
        "The one-year Nursing Break eligibility period has expired."
      );
    }
  }

  const start = value(formData, "start_date");
  const end = value(formData, "end_date");
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!start || !end || endDate < startDate) {
    throw new Error("Select a valid leave period.");
  }
  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
    throw new Error(
      "A leave request cannot cross two leave years. Submit a separate request for each year."
    );
  }

  const { data: overlap } = await admin
    .from("leave_requests")
    .select("id")
    .eq("employee_id", profile.id)
    .in("status", ["pending", "approved"])
    .lte("start_date", end)
    .gte("end_date", start)
    .limit(1)
    .maybeSingle();
  if (overlap) {
    throw new Error(
      "This period overlaps another pending or approved leave request."
    );
  }

  const requestedDays =
    leaveType.code === "NB"
      ? Number(value(formData, "requested_days") || 1)
      : await calculateRequestedDays({
          admin,
          profile,
          leaveType,
          start,
          end,
        });

  if (requestedDays <= 0) {
    throw new Error(
      "The selected period contains no eligible working days."
    );
  }

  if (leaveType.deducts_balance) {
    const year = startDate.getUTCFullYear();
    const balance = await availableBalance({
      admin,
      employeeId: profile.id,
      leaveTypeId: typeId,
      year,
      referenceDate: start,
    });

    if (!balance) {
      throw new Error(
        `No ${leaveType.name} balance exists for ${year}. Ask HR to create the annual balance first.`
      );
    }
    if (requestedDays > balance.available) {
      throw new Error(
        `Insufficient ${leaveType.name} balance. Available: ${balance.available}; requested: ${requestedDays}. Pending requests are included in this check.`
      );
    }
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  const file = formData.get("medical_document");

  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("The supporting document must be 10 MB or smaller.");
    }
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (file.type && !allowed.includes(file.type)) {
      throw new Error("Upload a PDF, JPG, PNG or WEBP document.");
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    attachmentPath = `${profile.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await admin.storage
      .from("leave-documents")
      .upload(attachmentPath, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Document upload failed: ${uploadError.message}`);
    }
    attachmentName = file.name;
  }

  if (leaveType.requires_document && !attachmentPath) {
    throw new Error(`${leaveType.name} requires a supporting document.`);
  }

  const { data: department } = profile.department_id
    ? await admin
        .from("departments")
        .select("head_id")
        .eq("id", profile.department_id)
        .maybeSingle()
    : { data: null };

  // Approval must follow the employee reporting line first.
  // Use the assigned Line Manager, then the dedicated Leave Approver,
  // and only use the Department Head as a fallback when neither exists.
  const primaryApprover =
    profile.manager_id ||
    profile.leave_approver_id ||
    department?.head_id ||
    null;
  const approverIds = primaryApprover ? [primaryApprover] : [];

  const { data: request, error } = await admin
    .from("leave_requests")
    .insert({
      employee_id: profile.id,
      submitted_by: profile.id,
      leave_type_id: typeId,
      start_date: start,
      end_date: end,
      requested_days: requestedDays,
      reason: value(formData, "reason") || null,
      approver_id: primaryApprover,
      // Do not create a parallel HR/HOD approval route. The request first
      // belongs only to the reporting-line approver selected above.
      department_head_id:
        primaryApprover === department?.head_id
          ? department?.head_id || null
          : null,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
    })
    .select("id")
    .single();

  if (error || !request) {
    throw new Error(error?.message || "Unable to submit leave request.");
  }

  const { data: approvers } = approverIds.length
    ? await admin
        .from("profiles")
        .select("id,email,full_name")
        .in("id", approverIds)
    : { data: [] as any[] };

  const managerEmails = [
    ...new Set(
      (approvers || [])
        .map((item: any) => String(item.email || "").trim())
        .filter(Boolean)
    ),
  ];
  const subject = `Leave approval required: ${profile.full_name} – ${leaveType.name}`;
  const teamRotaUrl = "https://teamrota-one.vercel.app/leave";
  const html = `<h2>Leave approval required</h2><p><b>${profile.full_name}</b> requested <b>${leaveType.name}</b> from ${start} to ${end}.</p><p><b>Requested days:</b> ${requestedDays}</p><p><b>Reason:</b> ${value(formData, "reason") || "Not provided"}</p><p><a href="${teamRotaUrl}" style="display:inline-block;padding:12px 20px;background:#155ee9;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">Open TeamRota Leave Requests</a></p><p style="font-size:12px;color:#64748b">Direct link: <a href="${teamRotaUrl}">${teamRotaUrl}</a></p>`;

  if (managerEmails.length === 0) {
    await logMail(admin, request.id, "submitted_no_approver", "", {
      status: "skipped",
      id: null,
      error:
        "No reporting-line approver email is configured. Assign a Line Manager, Leave Approver, or Department Head to this employee.",
    });
  }

  for (const email of managerEmails) {
    const result = await sendSystemEmail({
      to: [email],
      subject,
      html,
      idempotencyKey: `leave-submit-${request.id}-approver-${email}`,
    });
    await logMail(admin, request.id, "submitted_approver", email, result);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  return { ok: true as const };
}

function friendlyLeaveError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const message = raw.trim();

  if (
    /overlap/i.test(message) ||
    /exclude/i.test(message) ||
    /duplicate/i.test(message) ||
    /unique/i.test(message)
  ) {
    return "You already have a pending or approved leave request covering one or more of the selected dates. Please review your Leave History or choose different dates.";
  }

  if (/insufficient/i.test(message) && /balance/i.test(message)) {
    return message;
  }

  if (/no .* balance exists/i.test(message)) {
    return message;
  }

  if (/eligible working days/i.test(message)) {
    return "The selected period contains no eligible working days because it falls entirely on OFF days, rest days, or public holidays.";
  }

  if (/valid leave period/i.test(message)) {
    return "Please select a valid start date and end date. The end date cannot be earlier than the start date.";
  }

  if (/cross two leave years/i.test(message)) {
    return message;
  }

  if (/requires a supporting document/i.test(message)) {
    return message;
  }

  if (/document upload failed/i.test(message)) {
    return message;
  }

  console.error("Leave submission failed:", error);
  return "The leave request could not be submitted. No data was lost. Please try again, and contact HR or the TeamRota Administrator if the problem continues.";
}

export async function submitLeave(formData: FormData) {
  try {
    await submitLeaveInternal(formData);
  } catch (error) {
    const message = friendlyLeaveError(error);
    redirect(`/leave?error=${encodeURIComponent(message)}`);
  }

  redirect("/leave?submitted=1");
}


export async function assignPastLeave(formData: FormData) {
  const actor = await currentProfile();
  if (!canManageWorkforce(actor)) {
    throw new Error("Only Admin or HR can assign historical leave records.");
  }

  const admin = createAdminClient();
  const employeeId = value(formData, "employee_id");
  const typeId = value(formData, "leave_type_id");
  const start = value(formData, "start_date");
  const end = value(formData, "end_date");
  const reason = value(formData, "reason");
  const todayText = new Date().toISOString().slice(0, 10);

  if (!employeeId || !typeId || !start || !end) {
    throw new Error("Employee, leave type, start date and end date are required.");
  }
  if (start > todayText || end > todayText) {
    throw new Error("Historical leave dates cannot be in the future.");
  }

  const [{ data: employee }, { data: leaveType }] = await Promise.all([
    admin.from("profiles")
      .select("id,full_name,email,gender,manager_id,department_id,office_location,leave_approver_id")
      .eq("id", employeeId).single(),
    admin.from("leave_types").select("*").eq("id", typeId).single(),
  ]);
  if (!employee) throw new Error("Employee was not found.");
  if (!leaveType) throw new Error("Leave type was not found.");
  if (leaveType.code === "PH") {
    throw new Error("Public holidays must be created in the Holiday Calendar.");
  }
  if (leaveType.eligibility_gender && leaveType.eligibility_gender !== employee.gender) {
    throw new Error(`${leaveType.name} is not available for this employee.`);
  }

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (endDate < startDate) throw new Error("Select a valid historical leave period.");
  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
    throw new Error("Historical leave cannot cross two leave years. Create one record for each year.");
  }

  const { data: overlap } = await admin.from("leave_requests")
    .select("id")
    .eq("employee_id", employeeId)
    .in("status", ["pending", "approved"])
    .lte("start_date", end)
    .gte("end_date", start)
    .limit(1)
    .maybeSingle();
  if (overlap) throw new Error("The selected dates overlap an existing leave record.");

  const requestedDays = leaveType.code === "NB"
    ? Number(value(formData, "requested_days") || 1)
    : await calculateRequestedDays({ admin, profile: employee, leaveType, start, end });
  if (requestedDays <= 0) throw new Error("The selected period has no eligible leave days.");

  if (leaveType.deducts_balance) {
    const year = startDate.getUTCFullYear();
    const balance = await availableBalance({
      admin, employeeId, leaveTypeId: typeId, year, referenceDate: start,
    });
    if (!balance) throw new Error(`No ${leaveType.name} balance exists for ${year}.`);
    if (requestedDays > balance.available) {
      throw new Error(`Insufficient balance. Available: ${balance.available}; requested: ${requestedDays}.`);
    }
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  const file = formData.get("medical_document");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) throw new Error("The document must be 10 MB or smaller.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    attachmentPath = `${employee.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await admin.storage.from("leave-documents")
      .upload(attachmentPath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`Document upload failed: ${uploadError.message}`);
    attachmentName = file.name;
  }
  if (leaveType.requires_document && !attachmentPath) {
    throw new Error(`${leaveType.name} requires a supporting document.`);
  }

  const { data: request, error } = await admin.from("leave_requests").insert({
    employee_id: employee.id,
    submitted_by: actor.id,
    leave_type_id: typeId,
    start_date: start,
    end_date: end,
    requested_days: requestedDays,
    reason: reason || `Historical leave entered by ${actor.full_name}`,
    status: "approved",
    approver_id: actor.id,
    decided_at: new Date().toISOString(),
    decision_comment: `Historical leave assigned by ${actor.full_name}`,
    attachment_path: attachmentPath,
    attachment_name: attachmentName,
  }).select("id").single();
  if (error || !request) throw new Error(error?.message || "Unable to create historical leave.");

  if (leaveType.deducts_balance) {
    const year = startDate.getUTCFullYear();
    const { data: balance } = await admin.from("leave_balances")
      .select("id,used")
      .eq("employee_id", employee.id)
      .eq("leave_type_id", typeId)
      .eq("leave_year", year)
      .maybeSingle();
    if (!balance) throw new Error(`No ${leaveType.name} balance exists for ${year}.`);
    const { error: balanceError } = await admin.from("leave_balances")
      .update({ used: Number(balance.used || 0) + requestedDays }).eq("id", balance.id);
    if (balanceError) throw new Error(balanceError.message);
  }

  if (attachmentPath) {
    const archiveYear = startDate.getUTCFullYear();
    await archiveSupabaseObject({
      bucket: "leave-documents", path: attachmentPath, fileName: attachmentName || `historical-leave-${request.id}`, mimeType: "application/octet-stream",
      entityType: "leave_document", entityId: request.id, employeeId: employee.id, employeeName: employee.full_name, year: archiveYear,
      folders: ["TeamRota Documents", "Employees", `${employee.full_name} (${employee.id})`, "Leave Documents", String(archiveYear)], archivedBy: actor.id,
      metadata: { historical: true, leave_type: leaveType.name, start_date: start, end_date: end },
    }).catch((error) => console.error("Historical leave archive failed:", error));
  }

  if (employee.email) {
    const result = await sendSystemEmail({
      to: [employee.email],
      subject: `Historical leave recorded: ${leaveType.name}`,
      html: `<h2>Historical leave recorded</h2><p>${actor.full_name} recorded your ${leaveType.name} from ${start} to ${end} (${requestedDays} days).</p><p><b>Reason:</b> ${reason || "Administrative historical entry"}</p>`,
      idempotencyKey: `historical-leave-${request.id}-${employee.email}`,
    });
    await logMail(admin, request.id, "historical_leave_employee", employee.email, result);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  revalidatePath("/timesheets");
  redirect("/leave?historical=1");
}


function parseHistoricalDateList(raw: string): string[] {
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const values = raw
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const normalized = values.map((item) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(item)) return item;

    const named = item.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{4})$/);
    if (named) {
      const day = named[1].padStart(2, "0");
      const month = monthNames[named[2].slice(0, 3).toLowerCase()];
      if (!month) throw new Error(`Unknown month in date: ${item}`);
      return `${named[3]}-${month}-${day}`;
    }

    const numeric = item.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (numeric) {
      return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
    }

    throw new Error(`Unrecognized date format: ${item}. Use YYYY-MM-DD or DD-MMM-YYYY.`);
  });

  const unique = [...new Set(normalized)].sort();
  for (const date of unique) {
    const parsed = parseDate(date);
    if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== date) {
      throw new Error(`Invalid calendar date: ${date}`);
    }
  }
  return unique;
}

export async function assignBulkPastLeave(formData: FormData) {
  const actor = await currentProfile();
  if (!canManageWorkforce(actor)) {
    throw new Error("Only Admin or HR can upload bulk historical leave.");
  }

  const admin = createAdminClient();
  const employeeId = value(formData, "employee_id");
  const typeId = value(formData, "leave_type_id");
  const reason = value(formData, "reason");
  const rawDates = value(formData, "leave_dates");
  const dates = parseHistoricalDateList(rawDates);
  const today = new Date().toISOString().slice(0, 10);

  if (!employeeId || !typeId || dates.length === 0) {
    throw new Error("Employee, leave type and at least one historical date are required.");
  }
  if (dates.length > 100) {
    throw new Error("A maximum of 100 historical dates can be uploaded at one time.");
  }
  const futureDates = dates.filter((date) => date > today);
  if (futureDates.length) {
    throw new Error(`Historical dates cannot be in the future: ${futureDates.join(", ")}`);
  }

  const [{ data: employee }, { data: leaveType }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,full_name,email,gender,manager_id,department_id,office_location,leave_approver_id")
      .eq("id", employeeId)
      .single(),
    admin.from("leave_types").select("*").eq("id", typeId).single(),
  ]);

  if (!employee) throw new Error("Employee was not found.");
  if (!leaveType) throw new Error("Leave type was not found.");
  if (leaveType.code === "PH") throw new Error("Public holidays must be created in the Holiday Calendar.");
  if (leaveType.eligibility_gender && leaveType.eligibility_gender !== employee.gender) {
    throw new Error(`${leaveType.name} is not available for this employee.`);
  }

  const { data: overlaps, error: overlapError } = await admin
    .from("leave_requests")
    .select("start_date,end_date,status")
    .eq("employee_id", employeeId)
    .in("status", ["pending", "approved"])
    .lte("start_date", dates[dates.length - 1])
    .gte("end_date", dates[0]);
  if (overlapError) throw new Error(overlapError.message);

  const conflicting = dates.filter((date) =>
    (overlaps || []).some((row: any) => row.start_date <= date && row.end_date >= date)
  );
  if (conflicting.length) {
    throw new Error(`These dates already have pending or approved leave: ${conflicting.join(", ")}`);
  }

  const eligibleDates: string[] = [];
  const ineligibleDates: string[] = [];
  for (const date of dates) {
    const requestedDays = leaveType.code === "NB"
      ? 1
      : await calculateRequestedDays({ admin, profile: employee, leaveType, start: date, end: date });
    if (requestedDays > 0) eligibleDates.push(date);
    else ineligibleDates.push(date);
  }
  if (ineligibleDates.length) {
    throw new Error(`These dates are OFF days, rest days or public holidays and cannot be recorded for this leave type: ${ineligibleDates.join(", ")}`);
  }

  const totalsByYear = new Map<number, number>();
  for (const date of eligibleDates) {
    const year = Number(date.slice(0, 4));
    totalsByYear.set(year, (totalsByYear.get(year) || 0) + 1);
  }

  if (leaveType.deducts_balance) {
    for (const [year, total] of totalsByYear) {
      const balance = await availableBalance({
        admin,
        employeeId,
        leaveTypeId: typeId,
        year,
        referenceDate: `${year}-01-01`,
      });
      if (!balance) throw new Error(`No ${leaveType.name} balance exists for ${year}.`);
      if (total > balance.available) {
        throw new Error(`Insufficient ${leaveType.name} balance for ${year}. Available: ${balance.available}; bulk history requires: ${total}.`);
      }
    }
  }

  const file = formData.get("medical_document");
  let fileBytes: ArrayBuffer | null = null;
  let attachmentName: string | null = null;
  let contentType = "application/octet-stream";
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) throw new Error("The document must be 10 MB or smaller.");
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (file.type && !allowed.includes(file.type)) throw new Error("Upload a PDF, JPG, PNG or WEBP document.");
    fileBytes = await file.arrayBuffer();
    attachmentName = file.name;
    contentType = file.type || contentType;
  }
  if (leaveType.requires_document && !fileBytes) {
    throw new Error(`${leaveType.name} requires a supporting document.`);
  }

  const attachmentPaths = new Map<string, string>();
  if (fileBytes && attachmentName) {
    const safeName = attachmentName.replace(/[^a-zA-Z0-9._-]/g, "_");
    for (const date of eligibleDates) {
      const path = `${employee.id}/bulk-${Date.now()}-${date}-${safeName}`;
      const { error } = await admin.storage.from("leave-documents").upload(path, fileBytes, {
        contentType,
        upsert: false,
      });
      if (error) throw new Error(`Document upload failed for ${date}: ${error.message}`);
      attachmentPaths.set(date, path);
    }
  }

  const rows = eligibleDates.map((date) => ({
    employee_id: employee.id,
    submitted_by: actor.id,
    leave_type_id: typeId,
    start_date: date,
    end_date: date,
    requested_days: 1,
    reason: reason || `Bulk historical leave entered by ${actor.full_name}`,
    status: "approved",
    approver_id: actor.id,
    decided_at: new Date().toISOString(),
    decision_comment: `Bulk historical leave assigned by ${actor.full_name}`,
    attachment_path: attachmentPaths.get(date) || null,
    attachment_name: attachmentName,
  }));

  const { data: inserted, error: insertError } = await admin
    .from("leave_requests")
    .insert(rows)
    .select("id,start_date");
  if (insertError || !inserted) throw new Error(insertError?.message || "Unable to create bulk historical leave records.");

  if (leaveType.deducts_balance) {
    for (const [year, total] of totalsByYear) {
      const { data: balance } = await admin
        .from("leave_balances")
        .select("id,used")
        .eq("employee_id", employee.id)
        .eq("leave_type_id", typeId)
        .eq("leave_year", year)
        .maybeSingle();
      if (!balance) throw new Error(`No ${leaveType.name} balance exists for ${year}.`);
      const { error } = await admin
        .from("leave_balances")
        .update({ used: Number(balance.used || 0) + total })
        .eq("id", balance.id);
      if (error) throw new Error(error.message);
    }
  }

  if (fileBytes && attachmentName) {
    for (const row of inserted) {
      const path = attachmentPaths.get(row.start_date);
      if (!path) continue;
      archiveSupabaseObject({
        bucket: "leave-documents",
        path,
        fileName: attachmentName,
        mimeType: contentType,
        entityType: "leave_document",
        entityId: row.id,
        employeeId: employee.id,
        employeeName: employee.full_name,
        year: Number(row.start_date.slice(0, 4)),
        folders: ["TeamRota Documents", "Employees", `${employee.full_name} (${employee.id})`, "Leave Documents", row.start_date.slice(0, 4)],
        archivedBy: actor.id,
        metadata: { historical: true, bulk: true, leave_type: leaveType.name, leave_date: row.start_date },
      }).catch((error) => console.error("Bulk historical leave archive failed:", error));
    }
  }

  if (employee.email) {
    const result = await sendSystemEmail({
      to: [employee.email],
      subject: `Historical leave records added: ${leaveType.name}`,
      html: `<h2>Historical leave records added</h2><p>${actor.full_name} recorded ${eligibleDates.length} historical ${leaveType.name} date(s) in TeamRota.</p><p><b>Dates:</b> ${eligibleDates.join(", ")}</p><p><b>Reason:</b> ${reason || "Administrative historical entry"}</p>`,
      idempotencyKey: `bulk-historical-leave-${employee.id}-${Date.now()}`,
    });
    if (inserted[0]) await logMail(admin, inserted[0].id, "bulk_historical_leave_employee", employee.email, result);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  revalidatePath("/availability");
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  revalidatePath("/timesheets");
  redirect(`/leave?bulkHistorical=${eligibleDates.length}`);
}

export async function decideLeave(formData: FormData) {
  const profile = await currentProfile();
  const admin = createAdminClient();
  const id = value(formData, "request_id");
  const decision = value(formData, "decision");

  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Invalid leave decision.");
  }

  const { data: request } = await admin
    .from("leave_requests")
    .select("*,leave_types(*)")
    .eq("id", id)
    .single();
  if (!request) throw new Error("Request not found.");

  const { data: roleProfile } = await admin
    .from("profiles")
    .select("app_role")
    .eq("id", profile.id)
    .single();

  const decisionRole = String(roleProfile?.app_role || "").toLowerCase();
  const canOverride = decisionRole === "admin";
  const isAssignedApprover =
    request.approver_id === profile.id ||
    request.department_head_id === profile.id;

  // HR receives the record only after reporting-line approval. HR cannot
  // bypass the employee's manager at the initial approval stage.
  if (!canOverride && !isAssignedApprover) {
    throw new Error(
      "Only the assigned reporting-line approver or an Administrator can decide this request."
    );
  }
  if (request.status !== "pending") {
    throw new Error("This request has already been decided.");
  }

  if (decision === "approved" && request.leave_types?.deducts_balance) {
    const year = parseDate(request.start_date).getUTCFullYear();
    const balance = await availableBalance({
      admin,
      employeeId: request.employee_id,
      leaveTypeId: request.leave_type_id,
      year,
      referenceDate: request.start_date,
    });
    // The current request is included in pending, so add it back for approval validation.
    const availableForThisRequest =
      (balance?.available ?? 0) + Number(request.requested_days || 0);
    if (!balance || Number(request.requested_days) > availableForThisRequest) {
      throw new Error(
        "The employee no longer has enough available balance to approve this request."
      );
    }
  }

  const { error } = await admin
    .from("leave_requests")
    .update({
      status: decision,
      approver_id: profile.id,
      decided_at: new Date().toISOString(),
      decision_comment: value(formData, "decision_comment") || null,
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  if (decision === "approved" && request.leave_types?.deducts_balance) {
    const year = parseDate(request.start_date).getUTCFullYear();
    const { data: balance } = await admin
      .from("leave_balances")
      .select("id,used")
      .eq("employee_id", request.employee_id)
      .eq("leave_type_id", request.leave_type_id)
      .eq("leave_year", year)
      .maybeSingle();
    if (balance) {
      await admin
        .from("leave_balances")
        .update({ used: Number(balance.used) + Number(request.requested_days) })
        .eq("id", balance.id);
    }
  }

  const [{ data: employee }, { data: activeProfiles }] = await Promise.all([
    admin
      .from("profiles")
      .select("email,full_name")
      .eq("id", request.employee_id)
      .single(),
    admin
      .from("profiles")
      .select("email,app_role,job_title,employment_status")
      .eq("employment_status", "active"),
  ]);

  const hrEmails = [
    ...new Set(
      [
        ...(activeProfiles || [])
          .filter(
            (item: any) =>
              (String(item.app_role || "").toLowerCase() === "hr" || /(^|[^a-z])hr([^a-z]|$)|human\s*resources?|human\s*capital|people\s*(?:&|and)\s*culture|personnel/i.test(String(item.job_title || "")))
          )
          .map((item: any) => String(item.email || "").trim()),
        String(process.env.HR_NOTIFICATION_EMAIL || "").trim(),
      ].filter(Boolean)
    ),
  ];

  const employeeEmail = String(employee?.email || "").trim();
  const html = `<h2>Leave request ${decision}</h2><p>Your ${request.leave_types?.name} request from ${request.start_date} to ${request.end_date} was <b>${decision}</b>.</p><p>${value(formData, "decision_comment") || ""}</p>`;

  if (employeeEmail) {
    const result = await sendSystemEmail({
      to: [employeeEmail],
      subject: `Leave request ${decision}: ${request.leave_types?.name}`,
      html,
      idempotencyKey: `leave-${decision}-${id}-employee-${employeeEmail}`,
    });
    await logMail(
      admin,
      id,
      `${decision}_employee`,
      employeeEmail,
      result
    );
  }

  if (decision === "approved" && request.attachment_path) {
    const archiveYear = parseDate(request.start_date).getUTCFullYear();
    await archiveSupabaseObject({
      bucket: "leave-documents",
      path: request.attachment_path,
      fileName: request.attachment_name || `leave-${id}`,
      mimeType: "application/octet-stream",
      entityType: "leave_document",
      entityId: id,
      employeeId: request.employee_id,
      employeeName: employee?.full_name || "Employee",
      year: archiveYear,
      folders: ["TeamRota Documents", "Employees", `${employee?.full_name || "Employee"} (${request.employee_id})`, "Leave Documents", String(archiveYear)],
      archivedBy: profile.id,
      metadata: { leave_type: request.leave_types?.name, start_date: request.start_date, end_date: request.end_date },
    }).catch((error) => console.error("Leave archive failed:", error));
  }

  if (decision === "approved") {
    for (const hrEmail of hrEmails) {
      const result = await sendSystemEmail({
        to: [hrEmail],
        subject: `Approved leave: ${employee?.full_name || "Employee"} – ${request.leave_types?.name}`,
        html: `<h2>Approved leave request</h2><p><b>${employee?.full_name || "Employee"}</b>'s ${request.leave_types?.name} request from ${request.start_date} to ${request.end_date} was approved by ${profile.full_name}.</p><p>${value(formData, "decision_comment") || ""}</p>`,
        idempotencyKey: `leave-approved-${id}-hr-${hrEmail}`,
      });
      await logMail(admin, id, "approved_hr", hrEmail, result);
    }
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  redirect(`/leave?decision=${decision}`);
}


export async function amendLeaveDecision(formData: FormData) {
  const profile = await currentProfile();
  const admin = createAdminClient();
  const requestId = value(formData, "request_id");
  const newDecision = value(formData, "new_decision");
  const amendmentReason = value(formData, "amendment_reason");

  if (!["approved", "rejected"].includes(newDecision)) {
    throw new Error("Select a valid amended decision.");
  }
  if (amendmentReason.length < 5) {
    throw new Error("Provide a clear amendment reason of at least 5 characters.");
  }

  const { data: request, error: requestError } = await admin
    .from("leave_requests")
    .select("*,leave_types(*)")
    .eq("id", requestId)
    .single();

  if (requestError || !request) throw new Error("Leave request was not found.");
  if (!["approved", "rejected"].includes(request.status)) {
    throw new Error("Only approved or rejected requests can be amended.");
  }
  if (request.status === newDecision) {
    throw new Error(`The request is already ${newDecision}.`);
  }

  const isAdmin = String(profile.app_role || "").toLowerCase() === "admin";
  const isLineManager =
    request.approver_id === profile.id ||
    request.department_head_id === profile.id;

  if (!isAdmin && !isLineManager) {
    throw new Error("Only an Administrator or the assigned Line Manager can amend this decision.");
  }

  const year = parseDate(request.start_date).getUTCFullYear();
  let balance: any = null;
  if (request.leave_types?.deducts_balance) {
    const result = await admin
      .from("leave_balances")
      .select("id,used,entitled,adjustment,carried_forward")
      .eq("employee_id", request.employee_id)
      .eq("leave_type_id", request.leave_type_id)
      .eq("leave_year", year)
      .maybeSingle();
    balance = result.data;
  }

  if (newDecision === "approved" && request.leave_types?.deducts_balance) {
    if (!balance) throw new Error("The employee leave balance does not exist.");
    const total = Number(balance.entitled || 0) + Number(balance.adjustment || 0) + Number(balance.carried_forward || 0);
    const available = total - Number(balance.used || 0);
    if (Number(request.requested_days) > available) {
      throw new Error(`Insufficient balance to amend this request to approved. Available: ${available}.`);
    }
  }

  const now = new Date().toISOString();
  const previousStatus = request.status;

  const { error: updateError } = await admin
    .from("leave_requests")
    .update({
      status: newDecision,
      approver_id: profile.id,
      decided_at: now,
      decision_comment: amendmentReason,
      amended_at: now,
      amended_by: profile.id,
      amendment_reason: amendmentReason,
    })
    .eq("id", requestId)
    .eq("status", previousStatus);

  if (updateError) throw new Error(updateError.message);

  if (request.leave_types?.deducts_balance && balance) {
    const delta = newDecision === "approved"
      ? Number(request.requested_days)
      : -Number(request.requested_days);
    const newUsed = Math.max(0, Number(balance.used || 0) + delta);
    const { error: balanceError } = await admin
      .from("leave_balances")
      .update({ used: newUsed })
      .eq("id", balance.id);
    if (balanceError) throw new Error(balanceError.message);
  }

  await admin.from("leave_decision_audit").insert({
    leave_request_id: requestId,
    changed_by: profile.id,
    previous_status: previousStatus,
    new_status: newDecision,
    reason: amendmentReason,
  });

  const [{ data: employee }, { data: activeProfiles }] = await Promise.all([
    admin.from("profiles").select("email,full_name").eq("id", request.employee_id).single(),
    admin.from("profiles").select("email,app_role,job_title,employment_status").eq("employment_status", "active"),
  ]);

  const employeeEmail = String(employee?.email || "").trim();
  const employeeHtml = `<h2>Leave decision amended</h2><p>Your ${request.leave_types?.name} request from ${request.start_date} to ${request.end_date} has been changed from <b>${previousStatus}</b> to <b>${newDecision}</b> by ${profile.full_name}.</p><p><b>Reason:</b> ${amendmentReason}</p>`;

  if (employeeEmail) {
    const result = await sendSystemEmail({
      to: [employeeEmail],
      subject: `Leave decision amended to ${newDecision}: ${request.leave_types?.name}`,
      html: employeeHtml,
      idempotencyKey: `leave-amend-${requestId}-${newDecision}-employee-${Date.now()}`,
    });
    await logMail(admin, requestId, `amended_${newDecision}_employee`, employeeEmail, result);
  }

  if (newDecision === "approved") {
    const hrEmails = [...new Set([
      ...(activeProfiles || [])
        .filter((item: any) =>
          String(item.app_role || "").toLowerCase() === "hr" ||
          /(^|[^a-z])hr([^a-z]|$)|human\s*resources?|human\s*capital|people\s*(?:&|and)\s*culture|personnel/i.test(String(item.job_title || ""))
        )
        .map((item: any) => String(item.email || "").trim()),
      String(process.env.HR_NOTIFICATION_EMAIL || "").trim(),
    ].filter(Boolean))];

    for (const hrEmail of hrEmails) {
      const result = await sendSystemEmail({
        to: [hrEmail],
        subject: `Amended approved leave: ${employee?.full_name || "Employee"}`,
        html: `<h2>Leave decision amended</h2><p>${employee?.full_name || "Employee"}'s ${request.leave_types?.name} request was changed from <b>${previousStatus}</b> to <b>approved</b> by ${profile.full_name}.</p><p><b>Reason:</b> ${amendmentReason}</p>`,
        idempotencyKey: `leave-amend-${requestId}-approved-hr-${hrEmail}-${Date.now()}`,
      });
      await logMail(admin, requestId, "amended_approved_hr", hrEmail, result);
    }
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  revalidatePath("/timesheets");
  redirect(`/leave?amended=${newDecision}`);
}


export async function deleteLeaveHistory(formData: FormData) {
  const actor = await currentProfile();
  const isAdmin = String(actor.app_role || "").toLowerCase() === "admin";
  if (!isAdmin) {
    throw new Error("Only an Administrator can permanently remove leave history.");
  }

  const requestId = value(formData, "request_id");
  const deletionReason = value(formData, "deletion_reason");
  if (!requestId) throw new Error("Leave request ID is required.");
  if (deletionReason.length < 5) {
    throw new Error("Provide a deletion reason of at least 5 characters.");
  }

  const admin = createAdminClient();
  const { data: request, error: requestError } = await admin
    .from("leave_requests")
    .select("*,leave_types(id,name,code,deducts_balance),profiles!leave_requests_employee_id_fkey(full_name,email,employee_no)")
    .eq("id", requestId)
    .single();

  if (requestError || !request) throw new Error("Leave history record was not found.");

  // Restore the consumed balance before deleting an approved record.
  if (request.status === "approved" && request.leave_types?.deducts_balance) {
    const leaveYear = parseDate(request.start_date).getUTCFullYear();
    const { data: balance } = await admin
      .from("leave_balances")
      .select("id,used")
      .eq("employee_id", request.employee_id)
      .eq("leave_type_id", request.leave_type_id)
      .eq("leave_year", leaveYear)
      .maybeSingle();

    if (balance) {
      const restoredUsed = Math.max(
        0,
        Number(balance.used || 0) - Number(request.requested_days || 0)
      );
      const { error: balanceError } = await admin
        .from("leave_balances")
        .update({ used: restoredUsed })
        .eq("id", balance.id);
      if (balanceError) throw new Error(balanceError.message);
    }
  }

  // Preserve an immutable administrative audit snapshot before hard deletion.
  const { error: auditError } = await admin.from("leave_deletion_audit").insert({
    original_leave_request_id: request.id,
    employee_id: request.employee_id,
    employee_name: request.profiles?.full_name || null,
    employee_email: request.profiles?.email || null,
    leave_type_id: request.leave_type_id,
    leave_type_name: request.leave_types?.name || null,
    start_date: request.start_date,
    end_date: request.end_date,
    requested_days: request.requested_days,
    previous_status: request.status,
    reason: request.reason,
    deleted_by: actor.id,
    deletion_reason: deletionReason,
    record_snapshot: request,
  });
  if (auditError) throw new Error(`Unable to save deletion audit: ${auditError.message}`);

  if (request.attachment_path) {
    const { error: storageError } = await admin.storage
      .from("leave-documents")
      .remove([request.attachment_path]);
    if (storageError) {
      console.error("Unable to remove leave attachment:", storageError.message);
    }
  }

  const { error: deleteError } = await admin
    .from("leave_requests")
    .delete()
    .eq("id", requestId);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/rota");
  revalidatePath("/year-rota");
  revalidatePath("/timesheets");
  redirect("/leave?deleted=1");
}
