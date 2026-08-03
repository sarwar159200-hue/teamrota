import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  GitBranch,
  KeyRound,
  Network,
  PlusCircle,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canManageWorkforce, isAdminProfile } from "@/lib/access-control";
import {
  createEmployee,
  createOrganizationItem,
  removeSecondaryReportingLine,
  resetEmployeePassword,
  saveSecondaryReportingLine,
  updateDepartmentHead,
  updateEmployee,
  uploadEmployeePhoto,
} from "./actions";
import PasswordField from "@/app/components/PasswordField";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("app_role,job_title")
    .eq("id", user.id)
    .single();

  if (!canManageWorkforce(me)) redirect("/dashboard");
  const isAdmin = isAdminProfile(me);

  const [employeeResult, departmentResult, businessUnitResult, divisionResult, teamResult, positionResult, reportingResult] = await Promise.all([
    supabase.from("profiles").select("id,employee_no,full_name,email,phone,job_title,app_role,department_id,business_unit_id,division_id,team_id,position_id,manager_id,leave_approver_id,office_location,rotation_pattern,employment_status,gender,photo_url,join_date").order("full_name"),
    supabase.from("departments").select("id,name,code,division_id,head_id,active").order("name"),
    supabase.from("business_units").select("id,name,code,active").order("name"),
    supabase.from("divisions").select("id,name,code,business_unit_id,active").order("name"),
    supabase.from("teams").select("id,name,code,department_id,active").order("name"),
    supabase.from("positions").select("id,title,code,department_id,active").order("title"),
    supabase.from("employee_reporting_lines").select("id,employee_id,manager_id,label,active").eq("active", true).order("created_at"),
  ]);

  const employees = employeeResult.data || [];
  const departments = departmentResult.data || [];
  const businessUnits = businessUnitResult.data || [];
  const divisions = divisionResult.data || [];
  const teams = teamResult.data || [];
  const positions = positionResult.data || [];
  const reportingLines = reportingResult.data || [];
  const employeeName = new Map(employees.map((employee: any) => [employee.id, employee.full_name]));

  return (
    <main className="standalone-page admin-workspace">
      <header>
        <div>
          <p className="eyebrow">PHASE 17</p>
          <h1>People &amp; Structure</h1>
          <p className="muted">
            Admin manages accounts and security. Admin and HR manage workforce details, photos and reporting structures.
          </p>
        </div>
        <div className="header-actions">
          <Link className="outline-link" href="/dashboard">Dashboard</Link>
          <Link className="outline-link" href="/org-chart">Org chart</Link>
        </div>
      </header>

      {isAdmin && (
        <section className="panel admin-block">
          <div className="section-heading">
            <div><UserPlus /><div><h2>Create Employee Account</h2><p>Create the login and employee profile together.</p></div></div>
          </div>
          <form action={createEmployee} className="form-grid employee-create-grid">
            <input name="full_name" placeholder="Full name *" required />
            <input name="employee_no" placeholder="Employee ID" />
            <input name="email" type="email" placeholder="Work email *" required />
            <PasswordField />
            <input name="phone" placeholder="Phone" />
            <input name="job_title" placeholder="Job title" />
            <input name="office_location" placeholder="Office location" />
            <label>Join date<input name="join_date" type="date" /></label>
            <select name="gender" defaultValue="not_specified" required>
              <option value="not_specified">Gender not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
            <select name="app_role" defaultValue="employee">
              <option value="employee">Employee</option>
              <option value="manager">Line Manager</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
            <Select name="business_unit_id" label="Business unit" items={businessUnits} />
            <Select name="division_id" label="Division" items={divisions} />
            <Select name="department_id" label="Department" items={departments} />
            <Select name="team_id" label="Team" items={teams} />
            <select name="position_id" defaultValue="">
              <option value="">Position</option>
              {positions.filter((item: any) => item.active).map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <select name="manager_id" defaultValue="">
              <option value="">Line manager</option>
              {employees.filter((item: any) => item.employment_status === "active").map((item: any) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
            </select>
            <button className="primary-button"><PlusCircle size={17} />Create employee</button>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="panel admin-block security-admin-block">
          <div className="section-heading">
            <div><ShieldCheck /><div><h2>Account Security</h2><p>Administrators can view account emails and set a new temporary password. Existing passwords are never readable or stored in plain text.</p></div></div>
          </div>
          <div className="security-account-list">
            {employees.map((employee: any) => (
              <article className="security-account-card" key={employee.id}>
                <div>
                  <strong>{employee.full_name}</strong>
                  <small>{employee.email || "No email address"}</small>
                </div>
                <form action={resetEmployeePassword} className="temporary-password-form">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <PasswordField name="temporary_password" placeholder="Temporary password" />
                  <button className="primary-button"><KeyRound size={16} />Set temporary password</button>
                </form>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel admin-block">
        <div className="section-heading">
          <div><GitBranch /><div><h2>Secondary Reporting Lines</h2><p>Add dotted-line or functional reporting without replacing the employee&apos;s primary line manager.</p></div></div>
        </div>
        <form action={saveSecondaryReportingLine} className="form-grid dotted-report-form">
          <select name="employee_id" defaultValue="" required>
            <option value="">Employee *</option>
            {employees.filter((employee: any) => employee.employment_status === "active").map((employee: any) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
          </select>
          <select name="secondary_manager_id" defaultValue="" required>
            <option value="">Dotted-line manager *</option>
            {employees.filter((employee: any) => employee.employment_status === "active").map((employee: any) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
          </select>
          <input name="reporting_label" placeholder="Reporting label (e.g. Functional Manager)" />
          <button className="primary-button"><GitBranch size={16} />Add dotted line</button>
        </form>
        <div className="dotted-reporting-admin-list">
          {reportingLines.length === 0 ? <p className="muted">No secondary reporting lines have been added.</p> : reportingLines.map((line: any) => (
            <form action={removeSecondaryReportingLine} key={line.id} className="dotted-reporting-admin-row">
              <input type="hidden" name="reporting_line_id" value={line.id} />
              <span><b>{employeeName.get(line.employee_id) || "Employee"}</b> <i>······›</i> {employeeName.get(line.manager_id) || "Manager"}</span>
              <small>{line.label || "Functional reporting"}</small>
              <button aria-label="Remove"><X size={15} />Remove</button>
            </form>
          ))}
        </div>
      </section>

      <section className="panel admin-block">
        <div className="section-heading"><div><Building2 /><div><h2>Department Heads</h2><p>Assign the accountable head for each department.</p></div></div></div>
        <div className="department-head-grid">
          {departments.map((department: any) => (
            <form action={updateDepartmentHead} key={department.id} className="department-head-card">
              <input type="hidden" name="department_id" value={department.id} />
              <strong>{department.name}</strong>
              <select name="head_id" defaultValue={department.head_id || ""}>
                <option value="">No HOD</option>
                {employees.filter((employee: any) => employee.employment_status === "active").map((employee: any) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
              </select>
              <button>Save HOD</button>
            </form>
          ))}
        </div>
      </section>

      <section className="panel admin-block">
        <div className="section-heading"><div><Users /><div><h2>Employees</h2><p>Edit employee details, email, reporting line, status, gender and photo.</p></div></div></div>
        <div className="employee-edit-list">
          {employees.map((employee: any) => (
            <article className="employee-edit-card" key={employee.id}>
              <div className="employee-edit-header">
                {employee.photo_url ? <img src={employee.photo_url} className="employee-admin-photo" alt="" /> : <div className="avatar">{employee.full_name?.[0] || "E"}</div>}
                <div><strong>{employee.full_name}</strong><small>{employee.job_title || employee.email}</small></div>
              </div>
              <form action={updateEmployee} className="form-grid employee-edit-form">
                <input type="hidden" name="employee_id" value={employee.id} />
                <input name="full_name" defaultValue={employee.full_name || ""} />
                <input name="email" type="email" defaultValue={employee.email || ""} />
                <input name="employee_no" defaultValue={employee.employee_no || ""} placeholder="Employee ID" />
                <input name="phone" defaultValue={employee.phone || ""} placeholder="Phone" />
                <input name="job_title" defaultValue={employee.job_title || ""} placeholder="Job title" />
                <input name="office_location" defaultValue={employee.office_location || ""} placeholder="Location" />
                <label>Join date<input name="join_date" type="date" defaultValue={employee.join_date || ""} /></label>
                <select name="gender" defaultValue={employee.gender || "not_specified"}>
                  <option value="not_specified">Gender not specified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
                <select name="app_role" defaultValue={employee.app_role || "employee"}>
                  <option value="employee">Employee</option><option value="manager">Line Manager</option><option value="hr">HR</option><option value="admin">Admin</option>
                </select>
                <Select name="business_unit_id" label="Business unit" items={businessUnits} value={employee.business_unit_id} />
                <Select name="division_id" label="Division" items={divisions} value={employee.division_id} />
                <Select name="department_id" label="Department" items={departments} value={employee.department_id} />
                <Select name="team_id" label="Team" items={teams} value={employee.team_id} />
                <select name="position_id" defaultValue={employee.position_id || ""}><option value="">Position</option>{positions.map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
                <select name="manager_id" defaultValue={employee.manager_id || ""}><option value="">Line manager</option>{employees.filter((item: any) => item.id !== employee.id).map((item: any) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
                <select name="leave_approver_id" defaultValue={employee.leave_approver_id || ""}><option value="">Leave approver</option>{employees.filter((item: any) => item.id !== employee.id).map((item: any) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
                <select name="employment_status" defaultValue={employee.employment_status || "active"}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>
                <button className="primary-button">Save employee</button>
              </form>
              <form action={uploadEmployeePhoto} encType="multipart/form-data" className="employee-photo-form">
                <input type="hidden" name="employee_id" value={employee.id} />
                <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
                <button>Upload photo</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className="panel admin-block">
          <div className="section-heading"><div><Network /><div><h2>Create Organization Item</h2></div></div></div>
          <form action={createOrganizationItem} className="form-grid">
            <select name="type"><option value="business_units">Business Unit</option><option value="divisions">Division</option><option value="departments">Department</option><option value="teams">Team</option><option value="positions">Position</option></select>
            <input name="name" placeholder="Name *" required />
            <input name="code" placeholder="Code" />
            <button>Create</button>
          </form>
        </section>
      )}
    </main>
  );
}

function Select({ name, label, items, value = "" }: { name: string; label: string; items: any[]; value?: string }) {
  return (
    <select name={name} defaultValue={value || ""}>
      <option value="">{label}</option>
      {items.filter((item: any) => item.active !== false).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );
}
