"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";import {canManageWorkforce,isHrJobTitle} from "@/lib/access-control";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("app_role,job_title").eq("id", user.id).single();
  if (!canManageWorkforce(data)) throw new Error("Administrator or HR access is required.");
}


async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("app_role,job_title").eq("id", user.id).single();
  if (String(data?.app_role || "").toLowerCase() !== "admin") {
    throw new Error("Administrator access is required.");
  }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createEmployee(formData: FormData) {
  await requireSuperAdmin();
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const fullName = text(formData, "full_name");
  const jobTitle = text(formData, "job_title");
  const requestedRole = text(formData, "app_role") || "employee";
  const effectiveRole = requestedRole === "admin" ? "admin" : (isHrJobTitle(jobTitle) ? "hr" : requestedRole);
  if (!email || !fullName || password.length < 8) throw new Error("Full name, email and a password of at least 8 characters are required.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw new Error(error?.message || "Unable to create employee account.");

  const managerId = text(formData, "manager_id") || null;
  const { error: updateError } = await admin.from("profiles").update({
    employee_no: text(formData, "employee_no") || null,
    full_name: fullName,
    email,
    phone: text(formData, "phone") || null,
    job_title: jobTitle || null,
    app_role: effectiveRole,
    gender: text(formData, "gender") || "not_specified",
    department_id: text(formData, "department_id") || null,
    business_unit_id: text(formData, "business_unit_id") || null,
    division_id: text(formData, "division_id") || null,
    team_id: text(formData, "team_id") || null,
    position_id: text(formData, "position_id") || null,
    manager_id: managerId,
    leave_approver_id: managerId,
    office_location: text(formData, "office_location") || null,
    rotation_pattern: text(formData, "rotation_pattern") || "Office Based",
    employment_status: "active",
    join_date: text(formData, "join_date") || null,
  }).eq("id", data.user.id);
  if (updateError) { await admin.auth.admin.deleteUser(data.user.id); throw new Error(updateError.message); }
  revalidatePath("/admin"); revalidatePath("/dashboard"); revalidatePath("/org-chart");
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const employeeId = text(formData, "employee_id");
  const newEmail = text(formData, "email").toLowerCase();
  const jobTitle = text(formData, "job_title");
  const requestedRole = text(formData, "app_role") || "employee";
  const effectiveRole = requestedRole === "admin" ? "admin" : (isHrJobTitle(jobTitle) ? "hr" : requestedRole);
  const newEmploymentStatus = text(formData, "employment_status") || "active";

  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id,manager_id,leave_approver_id,employment_status,full_name")
    .eq("id", employeeId)
    .single();
  if (existingError || !existing) throw new Error(existingError?.message || "Employee was not found.");

  if (newEmail) {
    const { error: authError } = await admin.auth.admin.updateUserById(employeeId, { email: newEmail, email_confirm: true });
    if (authError) throw new Error(authError.message);
  }

  const newManagerId = text(formData, "manager_id") || null;
  const newLeaveApproverId = text(formData, "leave_approver_id") || newManagerId;
  const { error } = await admin.from("profiles").update({
    email: newEmail || null,
    employee_no: text(formData, "employee_no") || null,
    full_name: text(formData, "full_name") || null,
    phone: text(formData, "phone") || null,
    job_title: jobTitle || null,
    app_role: effectiveRole,
    gender: text(formData, "gender") || "not_specified",
    department_id: text(formData, "department_id") || null,
    business_unit_id: text(formData, "business_unit_id") || null,
    division_id: text(formData, "division_id") || null,
    team_id: text(formData, "team_id") || null,
    position_id: text(formData, "position_id") || null,
    manager_id: newManagerId,
    leave_approver_id: newLeaveApproverId,
    office_location: text(formData, "office_location") || null,
    rotation_pattern: text(formData, "rotation_pattern") || "Office Based",
    employment_status: newEmploymentStatus,
    join_date: text(formData, "join_date") || null,
  }).eq("id", employeeId);
  if (error) throw new Error(error.message);

  // When a manager leaves or becomes inactive, move their direct reports to
  // the departing manager's own manager (the next reporting level above).
  const managerHasLeft = existing.employment_status === "active" && newEmploymentStatus !== "active";
  if (managerHasLeft) {
    const successorManagerId = existing.manager_id || null;

    const { error: directReportsError } = await admin
      .from("profiles")
      .update({
        manager_id: successorManagerId,
        leave_approver_id: successorManagerId,
      })
      .eq("manager_id", employeeId);
    if (directReportsError) throw new Error(`Employee saved, but direct-report transfer failed: ${directReportsError.message}`);

    // Move any pending approvals to the same successor so requests do not get stuck.
    const { error: pendingLeaveError } = await admin
      .from("leave_requests")
      .update({ approver_id: successorManagerId, department_head_id: null })
      .eq("status", "pending")
      .eq("approver_id", employeeId);
    if (pendingLeaveError) throw new Error(`Employee saved, but pending leave transfer failed: ${pendingLeaveError.message}`);

    const { error: pendingOvertimeError } = await admin
      .from("overtime_requests")
      .update({ line_manager_id: successorManagerId })
      .eq("status", "pending")
      .eq("line_manager_id", employeeId);
    if (pendingOvertimeError) throw new Error(`Employee saved, but pending overtime transfer failed: ${pendingOvertimeError.message}`);

    await admin.from("departments").update({ head_id: successorManagerId }).eq("head_id", employeeId);
    await admin.from("employee_reporting_lines").update({ active: false, updated_at: new Date().toISOString() }).eq("manager_id", employeeId);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/org-chart");
  revalidatePath("/leave");
  revalidatePath("/overtime");
  revalidatePath("/rota");
}
export async function updateEmployeeEmail(formData: FormData) {
  await requireAdmin();
  const employeeId = text(formData, "employee_id");
  const email = text(formData, "email").toLowerCase();
  if (!employeeId || !email) throw new Error("Employee and email are required.");
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(employeeId, { email, email_confirm: true });
  if (authError) throw new Error(authError.message);
  const { error: profileError } = await admin.from("profiles").update({ email }).eq("id", employeeId);
  if (profileError) throw new Error(profileError.message);
  revalidatePath("/admin"); revalidatePath("/dashboard"); revalidatePath("/org-chart");
}

export async function createOrganizationItem(formData: FormData) {
  await requireAdmin();
  const type = text(formData, "type");
  const name = text(formData, "name");
  if (!name) throw new Error("Name is required.");
  const allowed = ["business_units", "divisions", "departments", "teams", "positions"];
  if (!allowed.includes(type)) throw new Error("Invalid organization type.");
  const admin = createAdminClient();
  const payload: Record<string, string | null> = { code: text(formData, "code") || null };
  if (type === "positions") payload.title = name; else payload.name = name;
  if (type === "divisions") payload.business_unit_id = text(formData, "parent_id") || null;
  if (type === "departments") payload.division_id = text(formData, "parent_id") || null;
  if (type === "teams") payload.department_id = text(formData, "parent_id") || null;
  if (type === "positions") payload.department_id = text(formData, "parent_id") || null;
  const nameColumn = type === "positions" ? "title" : "name";
  const { data: existing, error: lookupError } = await admin.from(type).select("id").ilike(nameColumn, name).limit(1).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing?.id) {
    const { error } = await admin.from(type).update({ ...payload, active: true }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from(type).insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin"); revalidatePath("/dashboard");
}

export async function toggleOrganizationItem(formData: FormData) {
  await requireAdmin();
  const type = text(formData, "type");
  const allowed = ["business_units", "divisions", "departments", "teams", "positions"];
  if (!allowed.includes(type)) throw new Error("Invalid organization type.");
  const admin = createAdminClient();
  const { error } = await admin.from(type).update({ active: text(formData, "active") === "true" }).eq("id", text(formData, "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/admin"); revalidatePath("/dashboard");
}


export async function updateDepartmentHead(formData: FormData) {
  await requireAdmin();
  const departmentId = text(formData, "department_id");
  const headId = text(formData, "head_id") || null;
  if (!departmentId) throw new Error("Department is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("departments").update({ head_id: headId }).eq("id", departmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin"); revalidatePath("/overtime"); revalidatePath("/dashboard");
}


export async function uploadEmployeePhoto(formData: FormData) {
  await requireAdmin();
  const employeeId = text(formData, "employee_id");
  const file = formData.get("photo");
  if (!employeeId || !(file instanceof File) || file.size === 0) throw new Error("Employee and photo are required.");
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Use JPG, PNG or WEBP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be smaller than 5 MB.");
  const admin = createAdminClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${employeeId}/profile.${ext}`;
  const { error } = await admin.storage.from("profile-photos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from("profile-photos").getPublicUrl(path);
  const { error: profileError } = await admin.from("profiles").update({ photo_url: data.publicUrl }).eq("id", employeeId);
  if (profileError) throw new Error(profileError.message);
  revalidatePath("/admin"); revalidatePath("/dashboard"); revalidatePath("/org-chart");
}


export async function resetEmployeePassword(formData: FormData) {
  await requireSuperAdmin();
  const employeeId = text(formData, "employee_id");
  const temporaryPassword = text(formData, "temporary_password");
  if (!employeeId || temporaryPassword.length < 8) {
    throw new Error("Select an employee and enter a temporary password of at least 8 characters.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(employeeId, {
    password: temporaryPassword,
    user_metadata: { force_password_change: true },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function saveSecondaryReportingLine(formData: FormData) {
  await requireAdmin();
  const employeeId = text(formData, "employee_id");
  const managerId = text(formData, "secondary_manager_id");
  const label = text(formData, "reporting_label") || "Functional reporting";
  if (!employeeId || !managerId) throw new Error("Employee and dotted-line manager are required.");
  if (employeeId === managerId) throw new Error("An employee cannot report to themselves.");

  const admin = createAdminClient();
  const { error } = await admin.from("employee_reporting_lines").upsert({
    employee_id: employeeId,
    manager_id: managerId,
    relationship_type: "dotted",
    label,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "employee_id,manager_id,relationship_type" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/org-chart");
}

export async function removeSecondaryReportingLine(formData: FormData) {
  await requireAdmin();
  const reportingLineId = text(formData, "reporting_line_id");
  if (!reportingLineId) throw new Error("Reporting line is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("employee_reporting_lines").delete().eq("id", reportingLineId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/org-chart");
}
