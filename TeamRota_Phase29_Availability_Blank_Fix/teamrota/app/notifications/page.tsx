import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck, MailWarning } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { emailConfiguration } from "@/lib/email";import {canManageWorkforce} from "@/lib/access-control";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("app_role,job_title")
    .eq("id", user.id)
    .single();

  if (!canManageWorkforce(me)) {
    redirect("/dashboard");
  }

  const [leaveResult, overtimeResult] = await Promise.all([
    supabase
      .from("leave_notification_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("overtime_notification_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const config = emailConfiguration();

  return (
    <main className="standalone-page">
      <header>
        <div>
          <p className="eyebrow">EMAIL</p>
          <h1>Notification Diagnostics</h1>
          <p className="muted">
            Use this page to confirm whether messages were sent,
            failed or skipped.
          </p>
        </div>

        <Link className="outline-link" href="/dashboard">
          Dashboard
        </Link>
      </header>

      <section className="panel admin-block">
        <div className="section-heading">
          <div>
            {config.configured ? (
              <MailCheck size={22} />
            ) : (
              <MailWarning size={22} />
            )}

            <div>
              <h2>Configuration</h2>
              <p>
                Provider: <b>{config.provider}</b>
              </p>
            </div>
          </div>
        </div>

        <p>
          Status:{" "}
          <b>
            {config.configured
              ? "Configured"
              : "Not configured"}
          </b>
        </p>

        <p>Sender: {config.from}</p>

        {!config.configured && (
          <div className="email-warning">
            <MailWarning size={18} />

            <span>
              Add <b>SMTP_HOST</b>, <b>SMTP_PORT</b>,{" "}
              <b>SMTP_USER</b>, <b>SMTP_PASS</b>,{" "}
              <b>EMAIL_FROM</b> and{" "}
              <b>HR_NOTIFICATION_EMAIL</b> in Vercel, then
              redeploy.
            </span>
          </div>
        )}
      </section>

      <section className="grid-two">
        <NotificationLog
          title="Leave notifications"
          rows={leaveResult.data || []}
        />

        <NotificationLog
          title="Overtime notifications"
          rows={overtimeResult.data || []}
        />
      </section>
    </main>
  );
}

function NotificationLog({
  title,
  rows,
}: {
  title: string;
  rows: any[];
}) {
  return (
    <article className="panel admin-block">
      <h2>{title}</h2>

      <div className="requests">
        {rows.length === 0 ? (
          <div className="empty-state compact">
            <p>No notification records found.</p>
          </div>
        ) : (
          rows.map((row) => {
            const eventType =
              row.event_type ||
              row.notification_type ||
              "notification";

            const recipient =
              row.recipient_email ||
              (Array.isArray(row.recipients)
                ? row.recipients.join(", ")
                : row.recipients) ||
              "No recipient";

            const status =
              row.delivery_status || "unknown";

            return (
              <div className="request" key={row.id}>
                <div>
                  <strong>{eventType}</strong>

                  <small>
                    {recipient} · {row.created_at}
                  </small>

                  {row.provider_message_id && (
                    <small>
                      Message ID: {row.provider_message_id}
                    </small>
                  )}

                  {row.error_message && (
                    <small>{row.error_message}</small>
                  )}
                </div>

                <span
                  className={
                    status === "sent"
                      ? "approved"
                      : status === "failed"
                      ? "rejected"
                      : "pending"
                  }
                >
                  {status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}
