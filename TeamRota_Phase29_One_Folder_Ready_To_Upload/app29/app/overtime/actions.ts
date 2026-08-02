"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSystemEmail } from "@/lib/email";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function currentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id,full_name,email,app_role,manager_id,department_id"
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    throw new Error("Employee profile was not found.");
  }

  return profile;
}

function hoursBetween(
  start: string,
  end: string,
  breakMinutes: number
) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  let minutes = eh * 60 + em - (sh * 60 + sm);

  if (minutes <= 0) {
    minutes += 24 * 60;
  }

  minutes -= breakMinutes;

  return Math.round((minutes / 60) * 100) / 100;
}

async function logEmail(
  requestId: string,
  type: string,
  recipients: string[],
  result: Awaited<ReturnType<typeof sendSystemEmail>>
) {
  try {
    const admin = createAdminClient();

    await admin.from("overtime_notification_log").insert({
      overtime_request_id: requestId,
      notification_type: type,
      recipients,
      delivery_status: result.status,
      provider_message_id: result.id,
      error_message: result.error,
    });
  } catch (error) {
    console.error("Unable to save overtime email log:", error);
  }
}

async function safeSendAndLog(options: {
  requestId: string;
  notificationType: string;
  recipients: string[];
  subject: string;
  html: string;
  idempotencyKey: string;
}) {
  const recipients = [
    ...new Set(
      options.recipients
        .map((email) => String(email || "").trim())
        .filter(Boolean)
    ),
  ];

  if (recipients.length === 0) {
    return;
  }

  try {
    const result = await sendSystemEmail({
      to: recipients,
      subject: options.subject,
      idempotencyKey: options.idempotencyKey,
      html: options.html,
    });

    await logEmail(
      options.requestId,
      options.notificationType,
      recipients,
      result
    );
  } catch (error) {
    console.error(
      `Email failed for ${options.notificationType}:`,
      error
    );
  }
}

async function getHrRecipients() {
  const admin = createAdminClient();

  const { data: activeProfiles } = await admin
    .from("profiles")
    .select("email,app_role,employment_status")
    .eq("employment_status", "active");

  const fallbackHr = String(
    process.env.HR_NOTIFICATION_EMAIL || ""
  ).trim();

  return [
    ...new Set(
      [
        ...(activeProfiles || [])
          .filter(
            (profile: any) =>
              String(profile.app_role || "").toLowerCase() === "hr"
          )
          .map((profile: any) =>
            String(profile.email || "").trim()
          ),
        fallbackHr,
      ].filter(Boolean)
    ),
  ];
}

export async function submitOvertime(formData: FormData) {
  const me = await currentUser();
  const admin = createAdminClient();

  const employeeId =
    me.app_role === "admin" && value(formData, "employee_id")
      ? value(formData, "employee_id")
      : me.id;

  const overtimeDate = value(formData, "overtime_date");
  const startTime = value(formData, "start_time");
  const endTime = value(formData, "end_time");
  const breakMinutes = Number(
    value(formData, "break_minutes") || 0
  );
  const justification = value(formData, "justification");

  if (
    !overtimeDate ||
    !startTime ||
    !endTime ||
    justification.length < 5
  ) {
    throw new Error(
      "Date, start time, end time and a clear justification are required."
    );
  }

  const requestedHours = hoursBetween(
    startTime,
    endTime,
    breakMinutes
  );

  if (requestedHours <= 0 || requestedHours > 24) {
    throw new Error(
      "The calculated overtime hours are invalid."
    );
  }

  const { data: employee, error: employeeError } = await admin
    .from("profiles")
    .select(
      "id,full_name,email,manager_id,department_id"
    )
    .eq("id", employeeId)
    .single();

  if (employeeError || !employee) {
    throw new Error("Employee was not found.");
  }

  const { data: department } = employee.department_id
    ? await admin
        .from("departments")
        .select("id,name,head_id")
        .eq("id", employee.department_id)
        .maybeSingle()
    : { data: null };

  const approverIds = [
    ...new Set(
      [employee.manager_id, department?.head_id].filter(Boolean)
    ),
  ] as string[];

  const { data: approvers } = approverIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", approverIds)
    : { data: [] };

  const { data: request, error } = await admin
    .from("overtime_requests")
    .insert({
      employee_id: employee.id,
      submitted_by: me.id,
      overtime_date: overtimeDate,
      start_time: startTime,
      end_time: endTime,
      break_minutes: breakMinutes,
      requested_hours: requestedHours,
      justification,
      line_manager_id: employee.manager_id,
      department_head_id: department?.head_id || null,
    })
    .select("id")
    .single();

  if (error || !request) {
    throw new Error(
      error?.message || "Unable to create overtime request."
    );
  }

  const approverRecipients = (approvers || [])
    .map((approver: any) =>
      String(approver.email || "").trim()
    )
    .filter(Boolean);

  const html = `
    <h2>Overtime approval required</h2>
    <p><strong>${employee.full_name}</strong> submitted an overtime request.</p>
    <p>
      <strong>Date:</strong> ${overtimeDate}<br/>
      <strong>Time:</strong> ${startTime}–${endTime}<br/>
      <strong>Hours:</strong> ${requestedHours}<br/>
      <strong>Justification:</strong> ${justification}
    </p>
    <p><a href="https://teamrota-one.vercel.app/overtime" style="display:inline-block;padding:12px 20px;background:#155ee9;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">Open TeamRota Overtime Requests</a></p>
    <p style="font-size:12px;color:#64748b">Direct link: <a href="https://teamrota-one.vercel.app/overtime">https://teamrota-one.vercel.app/overtime</a></p>
  `;

  // Manager and Head of Department receive separate emails.
  for (const approverEmail of approverRecipients) {
    await safeSendAndLog({
      requestId: request.id,
      notificationType: "approval_requested",
      recipients: [approverEmail],
      subject: `Overtime approval required: ${employee.full_name}`,
      idempotencyKey: `overtime-submit-${request.id}-${approverEmail}`,
      html,
    });
  }

  revalidatePath("/overtime");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");

  redirect("/overtime?submitted=1");
}

export async function decideOvertime(formData: FormData) {
  const me = await currentUser();
  const decision = value(formData, "decision");

  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Invalid overtime decision.");
  }

  const requestId = value(formData, "request_id");
  const comment = value(formData, "decision_comment");
  const admin = createAdminClient();

  const { data: request, error: requestError } = await admin
    .from("overtime_requests")
    .select(
      "id,status,employee_id,line_manager_id,department_head_id,overtime_date,start_time,end_time,requested_hours,justification"
    )
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    throw new Error("Overtime request was not found.");
  }

  if (request.status !== "pending") {
    throw new Error(
      "This overtime request has already been decided."
    );
  }

  const authorized =
    me.app_role === "admin" ||
    me.app_role === "hr" ||
    request.line_manager_id === me.id ||
    request.department_head_id === me.id;

  if (!authorized) {
    throw new Error(
      "You are not authorized to decide this overtime request."
    );
  }

  const { error } = await admin
    .from("overtime_requests")
    .update({
      status: decision,
      decided_by: me.id,
      decided_at: new Date().toISOString(),
      decision_comment: comment || null,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  const { data: employee } = await admin
    .from("profiles")
    .select("full_name,email")
    .eq("id", request.employee_id)
    .single();

  const employeeEmail = String(
    employee?.email || ""
  ).trim();

  const html = `
    <h2>Overtime request ${decision}</h2>
    <p>
      <strong>${employee?.full_name || "Employee"}</strong>'s overtime request
      was <strong>${decision}</strong> by ${me.full_name}.
    </p>
    <p>
      <strong>Date:</strong> ${request.overtime_date}<br/>
      <strong>Time:</strong> ${request.start_time}–${request.end_time}<br/>
      <strong>Hours:</strong> ${request.requested_hours}<br/>
      <strong>Justification:</strong> ${request.justification}
    </p>
    ${
      comment
        ? `<p><strong>Decision comment:</strong> ${comment}</p>`
        : ""
    }
  `;

  // Employee is notified for both approval and rejection.
  if (employeeEmail) {
    await safeSendAndLog({
      requestId,
      notificationType: `decision_${decision}_employee`,
      recipients: [employeeEmail],
      subject: `Overtime ${decision}: ${
        employee?.full_name || "Employee"
      }`,
      idempotencyKey: `overtime-${decision}-${requestId}-employee-${employeeEmail}`,
      html,
    });
  }

  // HR is notified only after approval.
  if (decision === "approved") {
    const hrRecipients = await getHrRecipients();
    let anyHrSent = false;

    for (const hrEmail of hrRecipients) {
      try {
        const result = await sendSystemEmail({
          to: [hrEmail],
          subject: `Approved overtime: ${
            employee?.full_name || "Employee"
          }`,
          idempotencyKey: `overtime-approved-${requestId}-hr-${hrEmail}`,
          html,
        });

        await logEmail(
          requestId,
          "decision_approved_hr",
          [hrEmail],
          result
        );

        if (result.status === "sent") {
          anyHrSent = true;
        }
      } catch (emailError) {
        console.error(
          `Unable to notify HR at ${hrEmail}:`,
          emailError
        );
      }
    }

    if (anyHrSent) {
      await admin
        .from("overtime_requests")
        .update({
          hr_notified_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }
  }

  revalidatePath("/overtime");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/rota");
  revalidatePath("/timesheet");

  redirect(`/overtime?decision=${decision}`);
}

export async function cancelOvertime(formData: FormData) {
  const me = await currentUser();
  const requestId = value(formData, "request_id");
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("overtime_requests")
    .select("employee_id,status")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    throw new Error(
      "Only pending requests can be cancelled."
    );
  }

  if (
    request.employee_id !== me.id &&
    me.app_role !== "admin"
  ) {
    throw new Error("You cannot cancel this request.");
  }

  const { error } = await admin
    .from("overtime_requests")
    .update({
      status: "cancelled",
      decided_by: me.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/overtime");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/timesheet");

  redirect("/overtime?decision=cancelled");
}

export async function updateOvertime(formData: FormData) {
  const me = await currentUser();
  const requestId = value(formData, "request_id");
  const overtimeDate = value(formData, "overtime_date");
  const startTime = value(formData, "start_time");
  const endTime = value(formData, "end_time");
  const breakMinutes = Number(value(formData, "break_minutes") || 0);
  const justification = value(formData, "justification");
  const reason = value(formData, "change_reason");
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("overtime_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) throw new Error("Overtime request was not found.");

  const privileged = ["admin", "hr"].includes(String(me.app_role || "").toLowerCase());
  const ownsPending = request.employee_id === me.id && request.status === "pending";
  if (!privileged && !ownsPending) throw new Error("You are not authorized to edit this overtime request.");
  if (!overtimeDate || !startTime || !endTime || justification.length < 5) {
    throw new Error("Date, start time, end time and justification are required.");
  }

  const requestedHours = hoursBetween(startTime, endTime, breakMinutes);
  const update = {
    overtime_date: overtimeDate,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
    requested_hours: requestedHours,
    justification,
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error } = await admin
    .from("overtime_requests")
    .update(update)
    .eq("id", requestId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await admin.from("overtime_change_audit").insert({
    overtime_request_id: requestId,
    action: "updated",
    changed_by: me.id,
    old_record: request,
    new_record: updated,
    reason: reason || "Overtime record corrected",
  });

  revalidatePath("/overtime");
  revalidatePath("/rota");
  revalidatePath("/timesheets");
  redirect("/overtime?updated=1");
}

export async function deleteOvertime(formData: FormData) {
  const me = await currentUser();
  const requestId = value(formData, "request_id");
  const reason = value(formData, "delete_reason");
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("overtime_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) throw new Error("Overtime request was not found.");

  const privileged = ["admin", "hr"].includes(String(me.app_role || "").toLowerCase());
  const ownsPending = request.employee_id === me.id && request.status === "pending";
  if (!privileged && !ownsPending) throw new Error("You are not authorized to delete this overtime request.");
  if (privileged && reason.length < 3) throw new Error("A deletion reason is required.");

  await admin.from("overtime_change_audit").insert({
    overtime_request_id: requestId,
    action: "deleted",
    changed_by: me.id,
    old_record: request,
    reason: reason || "Pending request removed by employee",
  });
  const { error } = await admin.from("overtime_requests").delete().eq("id", requestId);
  if (error) throw new Error(error.message);

  revalidatePath("/overtime");
  revalidatePath("/rota");
  revalidatePath("/timesheets");
  redirect("/overtime?deleted=1");
}
