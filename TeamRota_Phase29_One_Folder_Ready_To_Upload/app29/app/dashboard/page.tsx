import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Clock3,
  LayoutDashboard,
  MailCheck,
  HardDrive,
  Network,
  Palmtree,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import {
  canManageWorkforce,
  isAdminProfile,
  isManagerProfile,
} from "@/lib/access-control";

export default async function Dashboard({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const showWelcome = resolvedSearchParams.welcome === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,job_title,app_role,photo_url,employee_no")
    .eq("id", user.id)
    .single();

  const role = String(profile?.app_role || "employee").toLowerCase();
  const workforceAdmin = canManageWorkforce(profile);
  const privileged = workforceAdmin || isManagerProfile(profile);
  const today = new Date().toISOString().slice(0, 10);

  const [
    employeesResult,
    departmentsResult,
    pendingLeaveResult,
    leaveTodayResult,
    directoryResult,
    rotaTodayResult,
    holidayResult,
    overtimeResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("employment_status", "active"),
    supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
    supabase
      .from("employee_directory")
      .select(
        "id,full_name,job_title,position_title,department_name,manager_id,photo_url,employment_status"
      )
      .eq("employment_status", "active")
      .order("full_name")
      .limit(8),
    supabase
      .from("rota_assignments")
      .select("id", { count: "exact", head: true })
      .eq("work_date", today),
    supabase
      .from("holidays")
      .select("name,holiday_date")
      .eq("active", true)
      .gte("holiday_date", today)
      .order("holiday_date")
      .limit(1),
    supabase
      .from("overtime_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const employees = employeesResult.count || 0;
  const onLeave = leaveTodayResult.count || 0;
  const onDuty = Math.max(employees - onLeave, 0);
  const directory = directoryResult.data || [];
  const nextHoliday = holidayResult.data?.[0];
  const profileName = profile?.full_name || user.email || "TeamRota user";
  const profileTitle = profile?.job_title || role;

  return (
    <main className="app-shell phase14-shell">
      {showWelcome && (
        <section className="warm-welcome-banner" role="status">
          <div className="welcome-spark">✦</div>
          <div>
            <p>Welcome to TeamRota</p>
            <h2>Good to see you, {profileName}.</h2>
            <span>Your workforce dashboard is ready. Here is today’s overview.</span>
          </div>
          <Link href="/dashboard" className="welcome-dismiss" aria-label="Dismiss welcome message">×</Link>
        </section>
      )}
      <aside className="sidebar phase14-sidebar" aria-label="Main navigation">
        <div className="sidebar-logo">
          <Image
            src="/miran-energy-logo.png"
            alt="Miran Energy"
            width={190}
            height={65}
            priority
          />
        </div>

        <Link
          href="/profile"
          className="user-box phase14-user-box"
          aria-label={`Open profile for ${profileName}`}
          title="Open My Profile & Settings"
        >
          {profile?.photo_url ? (
            <img
              src={profile.photo_url}
              className="sidebar-photo"
              alt={`${profileName} profile`}
            />
          ) : (
            <div className="avatar" aria-hidden="true">
              {profileName[0]?.toUpperCase() || "U"}
            </div>
          )}

          <div className="sidebar-user-copy">
            <strong title={profileName}>{profileName}</strong>
            <small title={profileTitle}>{profileTitle}</small>
            <span className="sidebar-role-badge">{role}</span>
          </div>
        </Link>

        <nav>
          <Link className="active" href="/dashboard">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          <p>ORGANIZATION</p>
          <Link href="/org-chart">
            <Network size={18} />
            <span>Organization Chart</span>
          </Link>
          <Link href="/employees">
            <Users size={18} />
            <span>Employee Directory</span>
          </Link>
          {workforceAdmin && (
            <Link href="/admin">
              <Building2 size={18} />
              <span>People &amp; Structure</span>
            </Link>
          )}

          <p>WORKFORCE</p>
          <Link href="/rota">
            <CalendarDays size={18} />
            <span>Rota Planner</span>
          </Link>
          <Link href="/year-rota">
            <CalendarRange size={18} />
            <span>Annual Rota</span>
          </Link>
          <Link href="/holidays">
            <Palmtree size={18} />
            <span>Holiday Calendar</span>
          </Link>
          <Link href="/leave">
            <Palmtree size={18} />
            <span>Leave &amp; Balances</span>
          </Link>
          <Link href="/overtime">
            <Clock3 size={18} />
            <span>Overtime</span>
          </Link>
          <Link href="/timesheets">
            <CalendarRange size={18} />
            <span>Timesheets</span>
          </Link>
          <Link href="/profile">
            <UserCircle size={18} />
            <span>My Profile &amp; Settings</span>
          </Link>

          {isAdminProfile(profile) && (
            <>
              <p>ADMINISTRATION</p>
              <Link href="/admin">
                <ShieldCheck size={18} />
                <span>Admin Workspace</span>
              </Link>
              <Link href="/holidays">
                <Settings size={18} />
                <span>Holiday Settings</span>
              </Link>
              <Link href="/notifications">
                <MailCheck size={18} />
                <span>Email Diagnostics</span>
              </Link>
              <Link href="/admin/storage">
                <HardDrive size={18} />
                <span>Document Archive</span>
              </Link>
            </>
          )}
        </nav>

        <form action={signOut}>
          <button className="logout">Sign out</button>
        </form>
      </aside>

      <section className="content phase14-content">
        <header>
          <div>
            <p className="eyebrow">TEAM WORKSPACE</p>
            <h1>Dashboard</h1>
          </div>
          <span className="role-pill">{role}</span>
        </header>

        {privileged ? (
          <section className="stats phase2-stats">
            <Kpi
              href="/employees"
              label="Active Employees"
              value={employees}
              note="Open employee directory"
            />
            <Kpi
              href="/rota"
              label="On Duty Today"
              value={onDuty}
              note="Open rota planner"
            />
            <Kpi
              href="/leave"
              label="On Leave Today"
              value={onLeave}
              note="Approved leave today"
            />
            <Kpi
              href="/leave"
              label="Pending Leave"
              value={pendingLeaveResult.count || 0}
              note="Review leave requests"
            />
            <Kpi
              href="/admin"
              label="Departments"
              value={departmentsResult.count || 0}
              note="Open structure"
            />
            <Kpi
              href="/rota"
              label="Rota Entries Today"
              value={rotaTodayResult.count || 0}
              note="View today's rota"
            />
            <Kpi
              href="/overtime"
              label="Pending Overtime"
              value={overtimeResult.count || 0}
              note="Review overtime"
            />
          </section>
        ) : (
          <section className="stats phase2-stats">
            <Kpi href="/rota" label="My Rota" value="Open" note="View work and rest days" />
            <Kpi href="/leave" label="My Leave" value="Open" note="Balances and requests" />
            <Kpi href="/overtime" label="My Overtime" value="Open" note="Submit or view requests" />
            <Kpi href="/timesheets" label="My Timesheets" value="Open" note="Review monthly timesheets" />
          </section>
        )}

        <section className="grid-two phase2-grid">
          <article className="panel">
            <div className="panel-title">
              <div>
                <h2>Organization Overview</h2>
                <small>Live reporting hierarchy</small>
              </div>
              <Link className="outline-link" href="/org-chart">
                View full chart
              </Link>
            </div>
            <div className="directory-preview">
              {directory
                .filter((employee: any) => !employee.manager_id)
                .slice(0, 3)
                .map((employee: any) => (
                  <div className="person-card" key={employee.id}>
                    {employee.photo_url ? (
                      <img src={employee.photo_url} className="small-photo" alt="" />
                    ) : (
                      <div className="avatar small-avatar">
                        {employee.full_name?.[0]}
                      </div>
                    )}
                    <div>
                      <strong>{employee.full_name}</strong>
                      <small>{employee.position_title || employee.job_title}</small>
                      <small>{employee.department_name || "No department"}</small>
                    </div>
                  </div>
                ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-title">
              <div>
                <h2>Employee Directory</h2>
                <small>Active employees</small>
              </div>
              <Link className="outline-link" href="/employees">
                Open
              </Link>
            </div>
            <div className="requests">
              {directory.slice(0, 6).map((employee: any) => (
                <div className="request" key={employee.id}>
                  <div>
                    <strong>{employee.full_name}</strong>
                    <small>
                      {employee.position_title || employee.job_title || "No position"} ·{" "}
                      {employee.department_name || "No department"}
                    </small>
                  </div>
                  <span className="approved">Active</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="panel dashboard-next-holiday">
          <div>
            <CalendarDays size={28} />
            <div>
              <h2>Next Holiday</h2>
              <p>
                {nextHoliday
                  ? `${nextHoliday.name} · ${nextHoliday.holiday_date}`
                  : "No upcoming holiday configured"}
              </p>
            </div>
          </div>
          <Link className="outline-link" href="/holidays">
            Open calendar
          </Link>
        </section>
      </section>
    </main>
  );
}

function Kpi({
  href,
  label,
  value,
  note,
}: {
  href: string;
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <Link href={href} className="kpi-link">
      <article>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </article>
    </Link>
  );
}
