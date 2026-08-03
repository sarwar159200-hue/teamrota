import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PrintButton from "@/app/components/PrintButton";
import { generateAnnualRota } from "./actions";
import {
  datesBetween,
  isoDate,
  ROTA_LABELS,
  statusForDate,
} from "@/lib/rota-status";

const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const managerRoles = new Set([
  "manager",
  "line_manager",
  "department_manager",
  "project_manager",
  "supervisor",
]);

export default async function AnnualRotaPage({
  searchParams,
}: {
  searchParams?: Promise<{
    year?: string;
    employee?: string;
    month?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("profiles")
    .select("id,app_role,full_name")
    .eq("id", user.id)
    .single();
  if (!me) redirect("/login");

  const role = String(me.app_role || "employee").toLowerCase();
  const canManage = ["admin", "hr"].includes(role);
  const isManager = managerRoles.has(role);
  const params = await searchParams;
  const year = Math.min(
    Math.max(Number(params?.year || new Date().getFullYear()), 2020),
    2100
  );
  const month = Math.min(Math.max(Number(params?.month || 0), 0), 12);

  const { data: allEmployees } = await admin
    .from("profiles")
    .select(
      "id,full_name,job_title,department_id,office_location,manager_id,employment_status"
    )
    .eq("employment_status", "active")
    .order("full_name");

  const visibleEmployees = (allEmployees || []).filter((employee: any) => {
    if (canManage) return true;
    if (isManager) return employee.id === user.id || employee.manager_id === user.id;
    return employee.id === user.id;
  });

  const requestedEmployee = params?.employee;
  const selectedEmployee =
    visibleEmployees.find((employee: any) => employee.id === requestedEmployee) ||
    visibleEmployees.find((employee: any) => employee.id === user.id) ||
    visibleEmployees[0];

  if (!selectedEmployee) {
    return (
      <main className="standalone-page phase3-page">
        <h1>Annual Rota Planner</h1>
        <p>No active employee record is available.</p>
      </main>
    );
  }

  const startText = `${year}-01-01`;
  const endText = `${year}-12-31`;

  const [assignmentsResult, holidaysResult, leavesResult, rotationsResult, overtimeResult] =
    await Promise.all([
      admin
        .from("rota_assignments")
        .select(
          "employee_id,work_date,status_code,note,shift_start,shift_end,source"
        )
        .eq("employee_id", selectedEmployee.id)
        .gte("work_date", startText)
        .lte("work_date", endText)
        .order("work_date"),
      admin
        .from("holidays")
        .select("name,holiday_date,department_id,office_location")
        .eq("active", true)
        .gte("holiday_date", startText)
        .lte("holiday_date", endText),
      admin
        .from("leave_requests")
        .select(
          "employee_id,start_date,end_date,reason,leave_types(name,code)"
        )
        .eq("employee_id", selectedEmployee.id)
        .eq("status", "approved")
        .lte("start_date", endText)
        .gte("end_date", startText),
      admin
        .from("employee_rotations")
        .select(
          "employee_id,effective_from,effective_to,cycle_anchor_date,start_status,rotation_patterns(name,days_on,days_off,default_shift_code)"
        )
        .eq("employee_id", selectedEmployee.id)
        .eq("active", true)
        .lte("effective_from", endText),
      admin
        .from("overtime_requests")
        .select("employee_id,overtime_date,requested_hours,status")
        .eq("employee_id", selectedEmployee.id)
        .eq("status", "approved")
        .gte("overtime_date", startText)
        .lte("overtime_date", endText),
    ]);

  const days = datesBetween(
    new Date(`${startText}T00:00:00Z`),
    new Date(`${endText}T00:00:00Z`)
  ).map((date) => {
    const status = statusForDate({
      employee: selectedEmployee,
      date,
      assignments: assignmentsResult.data || [],
      holidays: holidaysResult.data || [],
      leaves: leavesResult.data || [],
      rotations: rotationsResult.data || [],
      overtime: overtimeResult.data || [],
    });
    const assignment = (assignmentsResult.data || []).find(
      (item: any) => item.work_date === isoDate(date)
    );
    return {
      date,
      dateText: isoDate(date),
      month: date.getUTCMonth() + 1,
      status,
      shiftStart: assignment?.shift_start || null,
      shiftEnd: assignment?.shift_end || null,
    };
  });

  const displayedDays = month
    ? days.filter((day) => day.month === month)
    : days;

  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const monthDays = days.filter((day) => day.month === index + 1);
    return {
      month: index + 1,
      working: monthDays.filter((day) => ["D", "N", "WFH", "BT", "TR"].includes(day.status.code)).length,
      off: monthDays.filter((day) => ["R", "OFF"].includes(day.status.code)).length,
      leave: monthDays.filter((day) => ["AL", "SL", "ML", "MAT", "NB", "PAT", "BL", "UL"].includes(day.status.code)).length,
      holiday: monthDays.filter((day) => day.status.code === "PH").length,
      overtime: monthDays.reduce((sum, day) => sum + Number(day.status.overtimeHours || 0), 0),
    };
  });

  return (
    <main className="standalone-page phase3-page annual-rota-page">
      <header>
        <div>
          <p className="eyebrow">WORKFORCE</p>
          <h1>Annual Rota Planner</h1>
          <p className="muted">
            View every working day, rest day, approved leave and public holiday for the selected employee.
          </p>
        </div>
        <div className="header-actions">
          <PrintButton />
          <Link className="outline-link" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>

      {canManage && (
        <section className="panel admin-block no-print">
          <div className="section-heading">
            <div>
              <CalendarRange />
              <div>
                <h2>Apply Weekly Pattern for a Whole Year</h2>
                <p>Choose weekly OFF days. All other days become working days.</p>
              </div>
            </div>
          </div>
          <form action={generateAnnualRota} className="form-grid">
            <input name="name" placeholder="Plan name" />
            <input
              name="rota_year"
              type="number"
              min="2020"
              max="2100"
              defaultValue={year}
            />
            <select name="employee_scope" defaultValue="all">
              <option value="all">All active employees</option>
              <option value="selected">Selected employees</option>
            </select>
            <select name="work_status_code" defaultValue="D">
              <option value="D">Working – Day</option>
              <option value="N">Working – Night</option>
              <option value="WFH">Remote Work</option>
            </select>
            <select name="off_status_code" defaultValue="R">
              <option value="R">Off – Rest</option>
              <option value="OFF">Off</option>
            </select>
            <div className="weekday-picker">
              <strong>Weekly OFF days</strong>
              {weekdayNames.map((name, index) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    name="off_weekdays"
                    value={index}
                    defaultChecked={index === 4 || index === 5}
                  />
                  {name}
                </label>
              ))}
            </div>
            <div className="employee-checks">
              <strong>Employees (used when Selected)</strong>
              {visibleEmployees.map((employee: any) => (
                <label key={employee.id}>
                  <input
                    type="checkbox"
                    name="employee_ids"
                    value={employee.id}
                  />
                  {employee.full_name}
                </label>
              ))}
            </div>
            <button className="primary-button">Apply to full year</button>
          </form>
        </section>
      )}

      <section className="panel admin-block">
        <div className="panel-title">
          <div>
            <h2>{selectedEmployee.full_name} — {year} Rota</h2>
            <small>{selectedEmployee.job_title || "Employee"}</small>
          </div>
        </div>

        <form className="year-filter no-print">
          {(canManage || isManager) && (
            <select name="employee" defaultValue={selectedEmployee.id}>
              {visibleEmployees.map((employee: any) => (
                <option value={employee.id} key={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          )}
          <input name="year" type="number" min="2020" max="2100" defaultValue={year} />
          <select name="month" defaultValue={String(month)}>
            <option value="0">Full year</option>
            {Array.from({ length: 12 }, (_, index) => (
              <option value={index + 1} key={index + 1}>
                {new Date(Date.UTC(year, index, 1)).toLocaleDateString("en", {
                  month: "long",
                  timeZone: "UTC",
                })}
              </option>
            ))}
          </select>
          <button>View</button>
          <PrintButton />
        </form>

        <div className="year-rota-grid annual-summary-grid">
          {monthlyTotals.map((item) => (
            <article key={item.month}>
              <strong>
                {new Date(Date.UTC(year, item.month - 1, 1)).toLocaleDateString("en", {
                  month: "long",
                  timeZone: "UTC",
                })}
              </strong>
              <span className="on-count">Working {item.working}</span>
              <span className="off-count">Off {item.off}</span>
              <span>Leave {item.leave}</span>
              <span>Holiday {item.holiday}</span>
              <span>Overtime {item.overtime} hrs</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel admin-block annual-table-panel">
        <div className="panel-title">
          <div>
            <h2>{month ? "Monthly" : "Full-Year"} Daily Rota Table</h2>
            <small>Date, weekday, work status, shift, leave and holiday detail</small>
          </div>
          <Users size={20} />
        </div>
        <div className="annual-rota-table-wrap">
          <table className="annual-rota-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Month</th>
                <th>Status</th>
                <th>Shift</th>
                <th>Details</th>
                <th>Overtime</th>
              </tr>
            </thead>
            <tbody>
              {displayedDays.map((day) => (
                <tr key={day.dateText}>
                  <td>{day.dateText}</td>
                  <td>
                    {day.date.toLocaleDateString("en-GB", {
                      weekday: "long",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td>
                    {day.date.toLocaleDateString("en-GB", {
                      month: "long",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td>
                    <span className={`shift ${day.status.code.toLowerCase()}`}>
                      {day.status.code === "D"
                        ? "ON"
                        : ["R", "OFF"].includes(day.status.code)
                          ? "OFF"
                          : day.status.code}
                    </span>
                    <span className="annual-status-label">
                      {day.status.label || ROTA_LABELS[day.status.code]}
                    </span>
                  </td>
                  <td>
                    {day.shiftStart && day.shiftEnd
                      ? `${String(day.shiftStart).slice(0, 5)}–${String(day.shiftEnd).slice(0, 5)}`
                      : "—"}
                  </td>
                  <td>{day.status.detail || "—"}</td>
                  <td>{day.status.overtimeHours ? `${day.status.overtimeHours} hrs` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
