import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, MapPin, PlusCircle, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canManageWorkforce } from "@/lib/access-control";
import { createHoliday, deleteHoliday, toggleHoliday, updateHoliday } from "./actions";

function day(value: string) { return new Date(`${value}T00:00:00Z`); }
function displayDate(value: string) { return day(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); }

export default async function HolidaysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("app_role,job_title,department_id").eq("id", user.id).single();
  const canManage = canManageWorkforce(me);
  const year = new Date().getFullYear();
  const [holidayResult, departmentResult] = await Promise.all([
    supabase.from("holidays").select("id,series_id,name,holiday_date,holiday_type,department_id,office_location,paid,recurring_annually,notes,active,departments(name)").gte("holiday_date", `${year-1}-01-01`).lte("holiday_date", `${year+2}-12-31`).order("holiday_date"),
    supabase.from("departments").select("id,name,active").eq("active", true).order("name"),
  ]);
  const rows: any[] = holidayResult.data ?? [];
  const departments = departmentResult.data ?? [];
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.series_id || row.id;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  const holidays = [...grouped.entries()].map(([seriesId, items]) => {
    const sorted = [...items].sort((a,b)=>a.holiday_date.localeCompare(b.holiday_date));
    return { ...sorted[0], series_id: seriesId, start_date: sorted[0].holiday_date, end_date: sorted[sorted.length-1].holiday_date, duration: sorted.length };
  }).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  const today = new Date(new Date().toDateString());
  const upcoming = holidays.filter(h=>h.active && day(h.end_date) >= today);

  return <main className="standalone-page phase3-page holiday-page">
    <header><div><p className="eyebrow">WORKFORCE CALENDAR</p><h1>Holiday Calendar</h1><p className="muted">Create single-day or multi-day holidays. Organization-wide holidays automatically appear for employees who would otherwise be working.</p></div><div className="header-actions"><Link className="outline-link" href="/rota">Rota Planner</Link><Link className="outline-link" href="/dashboard">Dashboard</Link></div></header>

    <section className="admin-summary phase3-summary">
      <article><CalendarDays/><strong>{holidays.filter(h=>h.active).length}</strong><span>Active holiday periods</span></article>
      <article><Building2/><strong>{holidays.filter(h=>h.holiday_type==='department').length}</strong><span>Department periods</span></article>
      <article><MapPin/><strong>{upcoming.length}</strong><span>Upcoming periods</span></article>
    </section>

    {canManage && <section className="panel admin-block holiday-editor-panel">
      <div className="section-heading"><div><PlusCircle/><div><h2>Create Holiday Period</h2><p>Select the first and last calendar day. Public and company holidays apply to all eligible working employees automatically.</p></div></div></div>
      <form action={createHoliday} className="form-grid holiday-create-grid">
        <input name="name" placeholder="Holiday name *" required/>
        <label>From<input name="start_date" type="date" required/></label>
        <label>To<input name="end_date" type="date" required/></label>
        <select name="holiday_type" defaultValue="public"><option value="public">Public holiday — all employees</option><option value="company">Company holiday — all employees</option><option value="department">Department holiday</option><option value="location">Location holiday</option></select>
        <select name="department_id" defaultValue=""><option value="">Select department when required</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <input name="office_location" placeholder="Office location when required"/>
        <select name="paid" defaultValue="true"><option value="true">Paid</option><option value="false">Unpaid</option></select>
        <select name="recurring_annually" defaultValue="false"><option value="false">One-time</option><option value="true">Recurring annually</option></select>
        <input name="notes" placeholder="Notes"/>
        <button className="primary-button" type="submit">Create holiday period</button>
      </form>
    </section>}

    <section className="panel admin-block">
      <div className="panel-title"><div><h2>Holiday Register</h2><small>{year-1}–{year+2}</small></div></div>
      <div className="holiday-list premium-holiday-list">
        {holidays.length === 0 ? <div className="empty-state"><CalendarDays size={34}/><p>No holidays have been created.</p></div> : holidays.map(h=><article key={h.series_id} className={!h.active ? "holiday-inactive" : ""}>
          <div className="holiday-date holiday-range-date"><strong>{displayDate(h.start_date)}</strong>{h.end_date!==h.start_date&&<><span>→</span><strong>{displayDate(h.end_date)}</strong></>}<small>{h.duration} calendar day{h.duration===1?'':'s'}</small></div>
          <div className="holiday-info"><strong>{h.name}</strong><small>{h.holiday_type.replace("_"," ")} · {h.departments?.name || h.office_location || "All eligible employees"}</small>{h.notes&&<small>{h.notes}</small>}</div>
          <div className="holiday-tags"><span>{h.paid ? "Paid" : "Unpaid"}</span>{h.recurring_annually&&<span>Annual</span>}<span className={h.active?'approved':'rejected'}>{h.active?'Active':'Inactive'}</span></div>
          {canManage&&<div className="holiday-actions">
            <details><summary><Pencil size={14}/>Edit</summary><form action={updateHoliday} className="holiday-edit-form"><input type="hidden" name="series_id" value={h.series_id}/><input name="name" defaultValue={h.name} required/><label>From<input name="start_date" type="date" defaultValue={h.start_date} required/></label><label>To<input name="end_date" type="date" defaultValue={h.end_date} required/></label><select name="holiday_type" defaultValue={h.holiday_type}><option value="public">Public holiday — all employees</option><option value="company">Company holiday — all employees</option><option value="department">Department holiday</option><option value="location">Location holiday</option></select><select name="department_id" defaultValue={h.department_id||''}><option value="">Select department when required</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><input name="office_location" defaultValue={h.office_location||''} placeholder="Office location"/><select name="paid" defaultValue={String(h.paid)}><option value="true">Paid</option><option value="false">Unpaid</option></select><select name="recurring_annually" defaultValue={String(h.recurring_annually)}><option value="false">One-time</option><option value="true">Recurring annually</option></select><input name="notes" defaultValue={h.notes||''} placeholder="Notes"/><button className="primary-button">Save changes</button></form></details>
            <form action={toggleHoliday}><input type="hidden" name="series_id" value={h.series_id}/><input type="hidden" name="active" value={String(!h.active)}/><button className={h.active?"status-inactive":"status-active"}>{h.active?"Deactivate":"Activate"}</button></form>
            <details className="danger-details"><summary><Trash2 size={14}/>Delete</summary><form action={deleteHoliday}><input type="hidden" name="series_id" value={h.series_id}/><p>Permanently remove this full holiday period.</p><input name="confirmation" placeholder="Type DELETE" required/><button className="reject-button">Delete holiday</button></form></details>
          </div>}
        </article>)}
      </div>
    </section>
  </main>;
}
