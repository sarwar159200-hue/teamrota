import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, UserCheck, UserX, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isoDate, statusForDate } from "@/lib/rota-status";

function availabilityLabel(code: string) {
  if (["D", "N", "WFH", "BT", "TR"].includes(code)) return "Available";
  if (["R", "OFF"].includes(code)) return "Off";
  if (code === "PH") return "Public Holiday";
  return "On Leave";
}

function availabilityClass(code: string) {
  if (["D", "N", "WFH", "BT", "TR"].includes(code)) return "available";
  if (["R", "OFF"].includes(code)) return "off";
  if (code === "PH") return "holiday";
  return "leave";
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = (await searchParams) || {};
  const query = String(Array.isArray(params.q) ? params.q[0] : params.q || "").trim().toLowerCase();
  const filter = String(Array.isArray(params.status) ? params.status[0] : params.status || "all");
  const admin = createAdminClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayDate = new Date(`${today}T00:00:00Z`);

  const [employeesResult, assignmentsResult, holidaysResult, leavesResult, rotationsResult, overtimeResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id,full_name,employee_no,job_title,department_id,office_location,photo_url,departments(name)")
      .eq("employment_status", "active")
      .order("full_name"),
    admin
      .from("rota_assignments")
      .select("employee_id,work_date,status_code,note,source")
      .eq("work_date", today),
    admin.from("holidays").select("*").eq("active", true),
    admin
      .from("leave_requests")
      .select("employee_id,start_date,end_date,reason,leave_types(name,code)")
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
    admin
      .from("employee_rotations")
      .select("employee_id,effective_from,effective_to,cycle_anchor_date,start_status,rotation_patterns(days_on,days_off,default_shift_code)")
      .eq("active", true)
      .lte("effective_from", today),
    admin
      .from("overtime_requests")
      .select("employee_id,overtime_date,requested_hours")
      .eq("status", "approved")
      .eq("overtime_date", today),
  ]);

  const rows = (employeesResult.data || []).map((employee: any) => {
    const status = statusForDate({
      employee,
      date: todayDate,
      assignments: assignmentsResult.data || [],
      holidays: holidaysResult.data || [],
      leaves: leavesResult.data || [],
      rotations: rotationsResult.data || [],
      overtime: overtimeResult.data || [],
    });
    return {
      employee,
      status,
      availability: availabilityLabel(status.code),
      className: availabilityClass(status.code),
    };
  });

  const filteredRows = rows.filter((row) => {
    const text = `${row.employee.full_name || ""} ${row.employee.employee_no || ""} ${row.employee.job_title || ""} ${row.employee.departments?.name || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesStatus = filter === "all" || row.className === filter;
    return matchesQuery && matchesStatus;
  });

  const availableCount = rows.filter((row) => row.className === "available").length;
  const unavailableCount = rows.length - availableCount;

  return (
    <main className="standalone-page availability-page">
      <header>
        <div>
          <p className="eyebrow">LIVE WORKFORCE</p>
          <h1>Who Is Available Today?</h1>
          <p className="muted">All employees can view today’s workforce availability without seeing confidential leave reasons.</p>
        </div>
        <Link className="outline-link" href="/dashboard">Dashboard</Link>
      </header>

      <section className="availability-summary">
        <article><Users size={20} /><span>Total employees</span><strong>{rows.length}</strong></article>
        <article><UserCheck size={20} /><span>Available today</span><strong>{availableCount}</strong></article>
        <article><UserX size={20} /><span>Not available</span><strong>{unavailableCount}</strong></article>
      </section>

      <section className="panel availability-controls">
        <form method="get">
          <label className="availability-search"><Search size={17} /><input name="q" defaultValue={String(Array.isArray(params.q) ? params.q[0] : params.q || "")} placeholder="Search employee, ID, job title or department" /></label>
          <select name="status" defaultValue={filter}>
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="off">Off</option>
            <option value="leave">On leave</option>
            <option value="holiday">Public holiday</option>
          </select>
          <button className="primary-button" type="submit">Apply filter</button>
        </form>
      </section>

      <section className="availability-grid">
        {filteredRows.map(({ employee, status, availability, className }) => (
          <article className="availability-card" key={employee.id}>
            <div className="availability-person">
              {employee.photo_url ? (
                <img src={employee.photo_url} alt="" className="availability-photo" />
              ) : (
                <div className="availability-avatar">{employee.full_name?.[0]?.toUpperCase() || "E"}</div>
              )}
              <div>
                <strong>{employee.full_name}</strong>
                <small>{employee.employee_no || "No employee ID"}</small>
                <span>{employee.job_title || "No job title"}</span>
                <span>{employee.departments?.name || "No department"}</span>
              </div>
            </div>
            <div className={`availability-status ${className}`}>
              <b>{availability}</b>
              <small>{status.label}</small>
              {status.overtimeHours ? <small>Approved OT: {status.overtimeHours}h</small> : null}
            </div>
          </article>
        ))}
        {filteredRows.length === 0 && <div className="empty-state"><p>No employees match the selected filters.</p></div>}
      </section>
    </main>
  );
}
