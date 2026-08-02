import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Download,
  MailWarning,
  Palmtree,
  Paperclip,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { amendLeaveDecision, assignPastLeave, decideLeave, deleteLeaveHistory, submitLeave } from "./actions";import {canManageWorkforce} from "@/lib/access-control";

export default async function LeavePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const submitted = params.submitted === "1";
  const errorMessage = rawError || "";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("id,app_role,job_title,gender,manager_id")
    .eq("id", user.id)
    .single();

  const year = new Date().getFullYear();
  const admin = createAdminClient();

  // Ensure every active employee has current and next-year balances before rendering.
  // This also repairs missing balances for employees created before this release.
  await admin.rpc("ensure_employee_leave_balances", { target_year: year });
  await admin.rpc("ensure_employee_leave_balances", { target_year: year + 1 });

  const [
    typesResult,
    balancesResult,
    requestsResult,
    maternityResult,
  ] = await Promise.all([
    supabase
      .from("leave_types")
      .select("*")
      .eq("active", true)
      .order("name"),

    admin
      .from("leave_balances")
      .select(
        "*,leave_types(name,code,entitlement_unit)"
      )
      .eq("employee_id", user.id)
      .eq("leave_year", year),

    supabase
      .from("leave_requests")
      .select(
        "*,leave_types(name,code),profiles!leave_requests_employee_id_fkey(full_name,email)"
      )
      .order("created_at", { ascending: false })
      .limit(200),

    supabase
      .from("leave_requests")
      .select("id,end_date,leave_types!inner(code)")
      .eq("employee_id", user.id)
      .eq("status", "approved")
      .eq("leave_types.code", "MAT")
      .order("end_date", { ascending: false })
      .limit(1),
  ]);

  const nursingEligible = (maternityResult.data || []).some(
    (request: any) => {
      const expiry = new Date(
        `${request.end_date}T00:00:00Z`
      );

      expiry.setUTCFullYear(
        expiry.getUTCFullYear() + 1
      );

      return expiry >= new Date();
    }
  );

  const visibleTypes = (typesResult.data || []).filter(
    (type: any) =>
      (!type.eligibility_gender ||
        type.eligibility_gender === me?.gender) &&
      (type.code !== "PH") && (type.code !== "NB" || nursingEligible)
  );

  const allRequests = requestsResult.data || [];

  const privileged = canManageWorkforce(me);
  const isAdmin = String(me?.app_role || "").toLowerCase() === "admin";

  const pendingRequests = allRequests.filter(
    (request: any) =>
      request.status === "pending" &&
      (privileged ||
        request.approver_id === user.id ||
        request.department_head_id === user.id)
  );

  const history = privileged
    ? allRequests
    : allRequests.filter(
        (request: any) =>
          request.employee_id === user.id ||
          request.approver_id === user.id ||
          request.department_head_id === user.id
      );

  const { data: managedEmployees } = privileged
    ? await admin
        .from("profiles")
        .select("id,full_name,employee_no,job_title,gender")
        .eq("employment_status", "active")
        .order("full_name")
    : { data: [] as any[] };

  const { data: workforceBalances } = privileged
    ? await admin
        .from("leave_balances")
        .select("id,employee_id,leave_year,entitled,used,carried_forward,adjustment,carried_forward_expires_on,leave_types(name,code,entitlement_unit)")
        .eq("leave_year", year)
        .order("employee_id")
    : { data: [] as any[] };

  const balancesByEmployee = new Map<string, any[]>();
  for (const balance of workforceBalances || []) {
    const rows = balancesByEmployee.get(balance.employee_id) || [];
    rows.push(balance);
    balancesByEmployee.set(balance.employee_id, rows);
  }

  const historicalTypes = (typesResult.data || []).filter((type: any) => type.code !== "PH");
  const documentLinks = new Map<string, string>();
  const requestsWithDocuments = history
    .filter((request: any) => Boolean(request.attachment_path))
    .slice(0, 50);
  const documentPaths = requestsWithDocuments.map(
    (request: any) => request.attachment_path
  );

  if (documentPaths.length > 0) {
    const { data: signedDocuments } = await admin.storage
      .from("leave-documents")
      .createSignedUrls(documentPaths, 3600);

    (signedDocuments || []).forEach((document: any, index: number) => {
      if (document?.signedUrl) {
        documentLinks.set(
          requestsWithDocuments[index].id,
          document.signedUrl
        );
      }
    });
  }

  const emailConfigured = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.EMAIL_FROM?.trim() &&
      process.env.HR_NOTIFICATION_EMAIL?.trim()
  );

  return (
    <main className="standalone-page phase3-page">
      <header>
        <div>
          <p className="eyebrow">LEAVE</p>
          <h1>Leave &amp; Balances</h1>
          <p className="muted">
            Request leave, view balances and review
            supporting documentation.
          </p>
        </div>

        <Link
          className="outline-link"
          href="/dashboard"
        >
          Dashboard
        </Link>
      </header>

      {errorMessage && (
        <div className="form-feedback form-feedback-error" role="alert">
          <strong>Leave request not submitted</strong>
          <span>{errorMessage}</span>
        </div>
      )}

      {submitted && (
        <div className="form-feedback form-feedback-success" role="status">
          <strong>Leave request submitted</strong>
          <span>Your request was saved and sent to the assigned approver.</span>
        </div>
      )}

      {!emailConfigured && privileged && (
        <div className="email-warning">
          <MailWarning size={18} />

          <span>
            Email notifications are disabled because Gmail
            SMTP settings are incomplete. Configure{" "}
            <b>SMTP_HOST</b>, <b>SMTP_PORT</b>,{" "}
            <b>SMTP_USER</b>, <b>SMTP_PASS</b>,{" "}
            <b>EMAIL_FROM</b> and{" "}
            <b>HR_NOTIFICATION_EMAIL</b> in Vercel, then
            redeploy.
          </span>
        </div>
      )}

      <section className="leave-balance-grid">
        {(balancesResult.data || []).length === 0 && (
          <article className="leave-balance-empty">
            <strong>Leave balances are being prepared</strong>
            <span>Please refresh once. If balances remain unavailable, contact HR.</span>
          </article>
        )}
        {(balancesResult.data || []).map(
          (balance: any) => {
            const carryExpiry = balance.carried_forward_expires_on
              ? new Date(`${balance.carried_forward_expires_on}T23:59:59Z`)
              : null;
            const effectiveCarry = carryExpiry && new Date() > carryExpiry
              ? 0
              : Number(balance.carried_forward || 0);
            const totalEntitlement =
              Number(balance.entitled) +
              effectiveCarry +
              Number(balance.adjustment);

            const remaining =
              totalEntitlement -
              Number(balance.used);

            return (
              <article key={balance.id}>
                <strong>
                  {balance.leave_types?.name}
                </strong>

                <span>
                  Entitled {totalEntitlement}
                </span>

                <span>
                  Used {balance.used}
                </span>

                <b>
                  Remaining {remaining}{" "}
                  {
                    balance.leave_types
                      ?.entitlement_unit
                  }
                </b>

                {Number(balance.carried_forward || 0) > 0 && (
                  <small>
                    Carry-forward: {effectiveCarry}
                    {balance.carried_forward_expires_on
                      ? ` · valid until ${balance.carried_forward_expires_on}`
                      : ""}
                  </small>
                )}
              </article>
            );
          }
        )}
      </section>

      {privileged && (
        <section className="panel admin-block workforce-balance-panel">
          <div className="section-heading">
            <div>
              <Palmtree />
              <div>
                <h2>All Employees Leave Balances</h2>
                <p>Admin and HR can review the current-year entitlement, usage, carry-forward and remaining balance for every active employee.</p>
              </div>
            </div>
            <span className="balance-year-badge">{year}</span>
          </div>

          <div className="workforce-balance-table-wrap">
            <table className="workforce-balance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Leave type</th>
                  <th>Entitled</th>
                  <th>Used</th>
                  <th>Carry-forward</th>
                  <th>Adjustment</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {(managedEmployees || []).flatMap((employee: any) => {
                  const employeeBalances = balancesByEmployee.get(employee.id) || [];
                  if (employeeBalances.length === 0) {
                    return [
                      <tr key={`${employee.id}-empty`}>
                        <td><strong>{employee.full_name}</strong><small>{employee.job_title || "No job title"}</small></td>
                        <td>{employee.employee_no || "—"}</td>
                        <td colSpan={6}><span className="no-balance-record">No balance records for {year}</span></td>
                      </tr>,
                    ];
                  }

                  return employeeBalances.map((balance: any, index: number) => {
                    const carryExpiry = balance.carried_forward_expires_on
                      ? new Date(`${balance.carried_forward_expires_on}T23:59:59Z`)
                      : null;
                    const effectiveCarry = carryExpiry && new Date() > carryExpiry
                      ? 0
                      : Number(balance.carried_forward || 0);
                    const entitled = Number(balance.entitled || 0);
                    const adjustment = Number(balance.adjustment || 0);
                    const used = Number(balance.used || 0);
                    const remaining = entitled + effectiveCarry + adjustment - used;

                    return (
                      <tr key={balance.id}>
                        {index === 0 && (
                          <>
                            <td rowSpan={employeeBalances.length}>
                              <strong>{employee.full_name}</strong>
                              <small>{employee.job_title || "No job title"}</small>
                            </td>
                            <td rowSpan={employeeBalances.length}>{employee.employee_no || "—"}</td>
                          </>
                        )}
                        <td><strong>{balance.leave_types?.name || "Leave"}</strong></td>
                        <td>{entitled}</td>
                        <td>{used}</td>
                        <td>{effectiveCarry}</td>
                        <td>{adjustment}</td>
                        <td><span className={remaining <= 0 ? "balance-low" : "balance-available"}>{remaining} {balance.leave_types?.entitlement_unit || "days"}</span></td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel admin-block">
        <div className="section-heading">
          <div>
            <Palmtree />

            <div>
              <h2>Request Leave</h2>
              <p>
                Maternity is female-only. Nursing Break
                appears only after approved maternity.
                Sick leave requires a document.
              </p>
            </div>
          </div>
        </div>

        <form
          action={submitLeave}
          className="form-grid"
          encType="multipart/form-data"
        >
          <select
            name="leave_type_id"
            required
            defaultValue=""
          >
            <option value="">
              Leave type *
            </option>

            {visibleTypes.map((type: any) => (
              <option
                key={type.id}
                value={type.id}
              >
                {type.name} ·{" "}
                {type.annual_allowance}{" "}
                {type.entitlement_unit}
              </option>
            ))}
          </select>

          <input
            name="start_date"
            type="date"
            required
          />

          <input
            name="end_date"
            type="date"
            required
          />

          <textarea
            name="reason"
            placeholder="Reason / justification"
            required
          />

          <label className="file-input">
            <Paperclip size={17} />
            Supporting document

            <input
              name="medical_document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
            />
          </label>

          <button className="primary-button">
            Submit request
          </button>
        </form>
      </section>


      {privileged && (
        <section className="panel admin-block">
          <div className="section-heading">
            <div>
              <Palmtree />
              <div>
                <h2>Assign Past Leave</h2>
                <p>Admin and HR can record approved leave taken before today. The employee balance, rota and timesheet update automatically.</p>
              </div>
            </div>
          </div>
          <form action={assignPastLeave} className="form-grid" encType="multipart/form-data">
            <select name="employee_id" required defaultValue="">
              <option value="">Employee *</option>
              {(managedEmployees || []).map((employee: any) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} · {employee.employee_no || "No ID"} · {employee.job_title || "No title"}
                </option>
              ))}
            </select>
            <select name="leave_type_id" required defaultValue="">
              <option value="">Leave type *</option>
              {historicalTypes.map((type: any) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            <input name="start_date" type="date" max={new Date().toISOString().slice(0, 10)} required />
            <input name="end_date" type="date" max={new Date().toISOString().slice(0, 10)} required />
            <textarea name="reason" placeholder="Historical leave reason / administrative note" required />
            <label className="file-input">
              <Paperclip size={17} /> Supporting document
              <input name="medical_document" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
            </label>
            <button className="primary-button" type="submit">Record approved past leave</button>
          </form>
        </section>
      )}

      {pendingRequests.length > 0 && (
        <section className="panel admin-block">
          <h2>Pending My Approval</h2>

          <div className="requests">
            {pendingRequests.map(
              (request: any) => (
                <form
                  key={request.id}
                  action={decideLeave}
                  className="request approval-request"
                >
                  <div>
                    <strong>
                      {request.profiles
                        ?.full_name ||
                        "Employee"}{" "}
                      ·{" "}
                      {
                        request.leave_types
                          ?.name
                      }
                    </strong>

                    <small>
                      {request.start_date} to{" "}
                      {request.end_date} ·{" "}
                      {request.requested_days}{" "}
                      days
                    </small>

                    {request.reason && (
                      <small>
                        Reason:{" "}
                        {request.reason}
                      </small>
                    )}

                    {documentLinks.get(
                      request.id
                    ) && (
                      <a
                        className="document-link"
                        href={documentLinks.get(
                          request.id
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={15} />
                        Open supporting document
                      </a>
                    )}
                  </div>

                  <input
                    type="hidden"
                    name="request_id"
                    value={request.id}
                  />

                  <input
                    name="decision_comment"
                    placeholder="Decision comment"
                  />

                  <button
                    name="decision"
                    value="approved"
                  >
                    Approve
                  </button>

                  <button
                    name="decision"
                    value="rejected"
                  >
                    Reject
                  </button>
                </form>
              )
            )}
          </div>
        </section>
      )}

      <section className="panel admin-block">
        <h2>Leave History</h2>

        <div className="requests">
          {history.map((request: any) => (
            <div
              className="request"
              key={request.id}
            >
              <div>
                <strong>
                  {privileged ||
                  request.employee_id !==
                    user.id
                    ? `${
                        request.profiles
                          ?.full_name ||
                        "Employee"
                      } · `
                    : ""}
                  {
                    request.leave_types
                      ?.name
                  }
                </strong>

                <small>
                  {request.start_date} to{" "}
                  {request.end_date} ·{" "}
                  {request.requested_days}{" "}
                  days
                </small>

                {request.attachment_name && (
                  <small>
                    Attachment:{" "}
                    {
                      request.attachment_name
                    }
                  </small>
                )}

                {documentLinks.get(
                  request.id
                ) && (
                  <a
                    className="document-link"
                    href={documentLinks.get(
                      request.id
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download size={15} />
                    View document
                  </a>
                )}
              </div>

              <div className="leave-history-actions">
                <span className={request.status}>
                  {request.status}
                </span>

                {(["approved", "rejected"].includes(request.status) &&
                  (isAdmin ||
                    request.approver_id === user.id ||
                    request.department_head_id === user.id)) && (
                  <details className="amend-decision">
                    <summary>Amend decision</summary>
                    <form action={amendLeaveDecision}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <select
                        name="new_decision"
                        defaultValue={request.status === "approved" ? "rejected" : "approved"}
                        required
                      >
                        <option value="approved">Change to approved</option>
                        <option value="rejected">Change to rejected</option>
                      </select>
                      <input
                        name="amendment_reason"
                        minLength={5}
                        placeholder="Amendment reason"
                        required
                      />
                      <button type="submit">Save amendment</button>
                    </form>
                  </details>
                )}

                {isAdmin && (
                  <details className="delete-leave-record">
                    <summary><Trash2 size={14} /> Remove history</summary>
                    <form action={deleteLeaveHistory}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <p>This permanently removes the leave record and restores the balance when applicable.</p>
                      <input
                        name="deletion_reason"
                        minLength={5}
                        placeholder="Reason for removing this history"
                        required
                      />
                      <button type="submit">Confirm permanent removal</button>
                    </form>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
