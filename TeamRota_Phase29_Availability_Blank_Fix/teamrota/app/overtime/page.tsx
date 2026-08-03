import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Clock3,
  CheckCircle2,
  XCircle,
  Send,
  ShieldCheck,
  MailWarning,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  submitOvertime,
  decideOvertime,
  cancelOvertime,
  updateOvertime,
  deleteOvertime,
} from "./actions";import {canManageWorkforce,isAdminProfile} from "@/lib/access-control";

export default async function OvertimePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("id,full_name,app_role,job_title")
    .eq("id", user.id)
    .single();

  if (!me) {
    redirect("/login");
  }

  const role = String(me.app_role || "").toLowerCase();
  const isAdmin = isAdminProfile(me);
  const isHr = canManageWorkforce(me) && !isAdmin;
  const canSeeAllRequests = canManageWorkforce(me);

  const emailConfigured = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.EMAIL_FROM?.trim() &&
      process.env.HR_NOTIFICATION_EMAIL?.trim()
  );

  const [{ data: employees }, { data: requests }] =
    await Promise.all([
      isAdmin
        ? supabase
            .from("profiles")
            .select("id,full_name,email")
            .eq("employment_status", "active")
            .order("full_name")
        : Promise.resolve({ data: [] as any[] }),

      supabase
        .from("overtime_requests")
        .select(
          "id,employee_id,submitted_by,overtime_date,start_time,end_time,break_minutes,requested_hours,justification,status,line_manager_id,department_head_id,decided_by,decided_at,decision_comment,created_at,employee:profiles!overtime_requests_employee_id_fkey(full_name,email,job_title),decider:profiles!overtime_requests_decided_by_fkey(full_name)"
        )
        .order("created_at", { ascending: false }),
    ]);

  const allRequests = requests || [];

  const pendingForMe = allRequests.filter(
    (request: any) =>
      request.status === "pending" &&
      (canSeeAllRequests ||
        request.line_manager_id === me.id ||
        request.department_head_id === me.id)
  );

  const visibleRequests = canSeeAllRequests
    ? allRequests
    : allRequests.filter(
        (request: any) => request.employee_id === me.id
      );

  const approvedCount = visibleRequests.filter(
    (request: any) => request.status === "approved"
  ).length;

  return (
    <main className="standalone-page phase3-page overtime-page">
      <header>
        <div>
          <p className="eyebrow">WORKFORCE</p>
          <h1>Overtime Management</h1>
          <p className="muted">
            Employees submit justified overtime. Line
            Managers and Heads of Department receive the
            request together, and either may decide it.
          </p>
        </div>

        <div className="header-actions">
          <Link className="outline-link" href="/dashboard">
            Dashboard
          </Link>

          {isAdmin && (
            <Link className="outline-link" href="/admin">
              <ShieldCheck size={17} />
              Admin
            </Link>
          )}
        </div>
      </header>

      {!emailConfigured && (
        <section className="email-warning">
          <MailWarning size={18} />

          <div>
            <strong>
              Email notifications are not configured.
            </strong>

            <span>
              Configure <b>SMTP_HOST</b>,{" "}
              <b>SMTP_PORT</b>, <b>SMTP_USER</b>,{" "}
              <b>SMTP_PASS</b>, <b>EMAIL_FROM</b> and{" "}
              <b>HR_NOTIFICATION_EMAIL</b> in Vercel,
              then redeploy.
            </span>
          </div>
        </section>
      )}

      <section className="stats phase3-summary overtime-summary">
        <article>
          <span>
            {canSeeAllRequests
              ? "Visible Requests"
              : "My Requests"}
          </span>
          <strong>{visibleRequests.length}</strong>
          <small>Submitted overtime records</small>
        </article>

        <article>
          <span>Pending My Approval</span>
          <strong>{pendingForMe.length}</strong>
          <small>Manager, HOD, HR or Admin action</small>
        </article>

        <article>
          <span>Approved</span>
          <strong>{approvedCount}</strong>
          <small>Authorized overtime records</small>
        </article>
      </section>

      <section className="panel admin-block">
        <div className="section-heading">
          <div>
            <Clock3 />

            <div>
              <h2>Submit Overtime</h2>
              <p>
                A clear business justification is mandatory.
              </p>
            </div>
          </div>
        </div>

        <form
          action={submitOvertime}
          className="form-grid overtime-create-grid"
        >
          {isAdmin && (
            <select name="employee_id" defaultValue="">
              <option value="">Submit for myself</option>

              {(employees || []).map((employee: any) => (
                <option
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.full_name} · {employee.email}
                </option>
              ))}
            </select>
          )}

          <label>
            Date
            <input
              name="overtime_date"
              type="date"
              required
            />
          </label>

          <label>
            Start time
            <input
              name="start_time"
              type="time"
              required
            />
          </label>

          <label>
            End time
            <input
              name="end_time"
              type="time"
              required
            />
          </label>

          <label>
            Break minutes
            <input
              name="break_minutes"
              type="number"
              min="0"
              max="720"
              defaultValue="0"
            />
          </label>

          <label className="overtime-justification">
            Justification
            <textarea
              name="justification"
              rows={4}
              minLength={5}
              placeholder="Explain why the overtime is required, the work to be completed, and the business impact."
              required
            />
          </label>

          <button
            className="primary-button"
            type="submit"
          >
            <Send size={17} />
            Submit for approval
          </button>
        </form>
      </section>

      {pendingForMe.length > 0 && (
        <section className="panel admin-block">
          <div className="section-heading">
            <div>
              <CheckCircle2 />

              <div>
                <h2>Pending My Approval</h2>
                <p>
                  The first authorized decision closes the
                  request.
                </p>
              </div>
            </div>
          </div>

          <div className="overtime-list">
            {pendingForMe.map((request: any) => (
              <article
                key={request.id}
                className="overtime-card"
              >
                <div className="overtime-card-head">
                  <div>
                    <strong>
                      {request.employee?.full_name}
                    </strong>
                    <small>
                      {request.employee?.job_title ||
                        request.employee?.email}
                    </small>
                  </div>

                  <span className="pending">Pending</span>
                </div>

                <div className="overtime-meta">
                  <span>
                    <b>Date</b>
                    {request.overtime_date}
                  </span>

                  <span>
                    <b>Time</b>
                    {String(request.start_time).slice(0, 5)}
                    –
                    {String(request.end_time).slice(0, 5)}
                  </span>

                  <span>
                    <b>Hours</b>
                    {request.requested_hours}
                  </span>
                </div>

                <p>
                  <strong>Justification:</strong>{" "}
                  {request.justification}
                </p>

                <form
                  action={decideOvertime}
                  className="overtime-decision-form"
                >
                  <input
                    type="hidden"
                    name="request_id"
                    value={request.id}
                  />

                  <input
                    name="decision_comment"
                    placeholder="Optional decision comment"
                  />

                  <button
                    name="decision"
                    value="approved"
                    className="approve-button"
                  >
                    <CheckCircle2 size={16} />
                    Approve
                  </button>

                  <button
                    name="decision"
                    value="rejected"
                    className="reject-button"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel admin-block">
        <div className="section-heading">
          <div>
            <Clock3 />

            <div>
              <h2>
                {canSeeAllRequests
                  ? "All Overtime Requests"
                  : "My Overtime History"}
              </h2>
              <p>
                Approval status, decision details and hours.
              </p>
            </div>
          </div>
        </div>

        <div className="overtime-list">
          {visibleRequests.length === 0 ? (
            <div className="empty-state compact">
              <p>
                No overtime requests have been submitted.
              </p>
            </div>
          ) : (
            visibleRequests.map((request: any) => (
              <article
                key={request.id}
                className="overtime-card"
              >
                <div className="overtime-card-head">
                  <div>
                    <strong>
                      {request.employee?.full_name ||
                        me.full_name}
                    </strong>

                    <small>
                      Submitted{" "}
                      {new Date(
                        request.created_at
                      ).toLocaleString()}
                    </small>
                  </div>

                  <span className={request.status}>
                    {request.status}
                  </span>
                </div>

                <div className="overtime-meta">
                  <span>
                    <b>Date</b>
                    {request.overtime_date}
                  </span>

                  <span>
                    <b>Time</b>
                    {String(request.start_time).slice(0, 5)}
                    –
                    {String(request.end_time).slice(0, 5)}
                  </span>

                  <span>
                    <b>Hours</b>
                    {request.requested_hours}
                  </span>
                </div>

                <p>
                  <strong>Justification:</strong>{" "}
                  {request.justification}
                </p>

                {request.decider?.full_name && (
                  <p className="muted">
                    Decision by{" "}
                    {request.decider.full_name}
                    {request.decision_comment
                      ? ` · ${request.decision_comment}`
                      : ""}
                  </p>
                )}

                {request.status === "pending" &&
                  (request.employee_id === me.id || isAdmin) && (
                    <form action={cancelOvertime}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button className="cancel-button">Cancel request</button>
                    </form>
                  )}

                {(canSeeAllRequests || (request.employee_id === me.id && request.status === "pending")) && (
                  <details className="record-maintenance">
                    <summary>Edit or delete overtime</summary>
                    <form action={updateOvertime} className="maintenance-grid">
                      <input type="hidden" name="request_id" value={request.id} />
                      <label>Date<input name="overtime_date" type="date" defaultValue={request.overtime_date} required /></label>
                      <label>Start<input name="start_time" type="time" defaultValue={String(request.start_time).slice(0,5)} required /></label>
                      <label>End<input name="end_time" type="time" defaultValue={String(request.end_time).slice(0,5)} required /></label>
                      <label>Break minutes<input name="break_minutes" type="number" min="0" max="720" defaultValue={request.break_minutes || 0} /></label>
                      <label className="wide">Justification<textarea name="justification" defaultValue={request.justification} required /></label>
                      <label className="wide">Change reason<input name="change_reason" placeholder="Reason for correction" /></label>
                      <button className="approve-button">Save changes</button>
                    </form>
                    <form action={deleteOvertime} className="delete-record-form">
                      <input type="hidden" name="request_id" value={request.id} />
                      <input name="delete_reason" placeholder="Deletion reason" required={canSeeAllRequests} />
                      <button className="reject-button">Delete overtime</button>
                    </form>
                  </details>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
