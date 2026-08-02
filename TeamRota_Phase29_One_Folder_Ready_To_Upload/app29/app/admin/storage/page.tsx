import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, CheckCircle2, CircleAlert, HardDrive, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { googleDriveConfiguration } from "@/lib/google-drive";
import { isAdminProfile } from "@/lib/access-control";

export default async function StorageArchivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id,app_role,job_title").eq("id", user.id).single();
  if (!isAdminProfile(profile)) redirect("/dashboard");
  const cfg = googleDriveConfiguration();
  const { data: rows } = await supabase.from("document_archives").select("*").order("created_at", { ascending: false }).limit(100);

  return <main className="standalone-page phase3-page">
    <header><div><p className="eyebrow">ARCHIVE</p><h1>Document Archive</h1><p className="muted">Supabase keeps active files; Google Drive stores finalized long-term records.</p></div><Link className="outline-link" href="/dashboard">Dashboard</Link></header>
    <section className="panel admin-block"><h2><HardDrive size={20}/> Google Drive connection</h2><p>Status: <b>{cfg.configured ? "Configured" : "Not configured"}</b></p><p>Account: {cfg.account}</p><p>Root folder: {cfg.rootFolderId === "root" ? "My Drive root" : cfg.rootFolderId}</p>{!cfg.configured && <div className="email-warning"><CircleAlert size={18}/> Missing Vercel variables: {cfg.missing.join(", ")}</div>}</section>
    <section className="panel admin-block"><h2><Archive size={20}/> Recent archive activity</h2><div className="requests">{(rows||[]).length===0?<div className="empty-state compact"><p>No records have been archived yet.</p></div>:(rows||[]).map((r:any)=><div className="request" key={r.id}><div><strong>{r.file_name}</strong><small>{r.entity_type} · {r.created_at}</small>{r.error_message&&<small>{r.error_message}</small>}{r.provider_web_url&&<a href={r.provider_web_url} target="_blank" rel="noreferrer">Open in Google Drive</a>}</div><span className={r.archive_status==='archived'?'approved':r.archive_status==='failed'?'rejected':'pending'}>{r.archive_status==='archived'?<CheckCircle2 size={14}/>:r.archive_status==='failed'?<XCircle size={14}/>:null}{r.archive_status}</span></div>)}</div></section>
  </main>;
}
