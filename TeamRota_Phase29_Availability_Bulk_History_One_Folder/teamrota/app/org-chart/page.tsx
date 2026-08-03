import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OrgChartClient, { Person, ReportingLine } from "@/app/components/OrgChartClient";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: people }, { data: reportingLines }] = await Promise.all([
    admin
      .from("employee_directory")
      .select("id,full_name,job_title,position_title,department_name,manager_id,email,phone,photo_url")
      .eq("employment_status", "active")
      .order("full_name"),
    admin
      .from("employee_reporting_lines")
      .select("id,employee_id,manager_id,label,relationship_type,active")
      .eq("active", true),
  ]);

  return (
    <main className="standalone-page">
      <header>
        <div>
          <p className="eyebrow">ORGANIZATION</p>
          <h1>Organization Chart</h1>
          <p className="muted">
            Solid lines show the primary manager. Dotted lines show secondary or functional reporting.
          </p>
        </div>
        <div className="header-actions">
          <Link className="outline-link" href="/employees">Employee Directory</Link>
          <Link className="outline-link" href="/dashboard">Dashboard</Link>
        </div>
      </header>
      <section className="panel org-chart-page">
        <OrgChartClient
          people={(people || []) as Person[]}
          reportingLines={(reportingLines || []) as ReportingLine[]}
        />
      </section>
    </main>
  );
}
