import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, CalendarDays, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateMyProfile, uploadMyPhoto } from "./actions";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function Profile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,phone,job_title,photo_url,gender,office_location,employee_no,join_date")
    .eq("id", user.id)
    .single();

  const email = profile?.email || user.email || "";
  const name = profile?.full_name || "TeamRota User";

  return (
    <main className="standalone-page premium-settings-page">
      <header className="premium-page-header">
        <div>
          <p className="eyebrow">PROFILE &amp; SETTINGS</p>
          <h1>My Account</h1>
          <p className="muted">Manage your personal information, profile photo and account security.</p>
        </div>
        <Link className="outline-link" href="/dashboard">Back to Dashboard</Link>
      </header>

      <section className="profile-hero panel">
        <div className="profile-photo-wrap">
          {profile?.photo_url ? (
            <Image src={profile.photo_url} alt={name} width={160} height={160} className="premium-profile-photo" />
          ) : (
            <div className="premium-profile-placeholder">{name[0]?.toUpperCase() || "U"}</div>
          )}
          <span className="verified-dot" title="Active employee"><BadgeCheck size={20} /></span>
        </div>

        <div className="profile-identity">
          <p className="eyebrow">EMPLOYEE PROFILE</p>
          <h2>{name}</h2>
          <p className="profile-job"><BriefcaseBusiness size={17} />{profile?.job_title || "Job title not assigned"}</p>
          <div className="profile-meta-chips">
            <span><UserRound size={15} />{profile?.employee_no || "Employee ID pending"}</span>
            <span><CalendarDays size={15} />Joined {profile?.join_date || "Not assigned"}</span>
            <span><Mail size={15} />{email}</span>
          </div>
        </div>

        <form action={uploadMyPhoto} encType="multipart/form-data" className="photo-upload-card">
          <strong>Update profile photo</strong>
          <small>JPG, PNG or WEBP, maximum 5 MB.</small>
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
          <button className="outline-link">Upload photo</button>
        </form>
      </section>

      <section className="settings-grid premium-settings-grid">
        <article className="panel personal-settings-card">
          <div className="security-card-heading">
            <span className="security-icon"><UserRound size={22} /></span>
            <div>
              <p className="eyebrow">PERSONAL DETAILS</p>
              <h2>Contact information</h2>
              <p>Keep your employee contact information accurate and up to date.</p>
            </div>
          </div>

          <form action={updateMyProfile} className="settings-form polished-form">
            <label>Full name<span className="input-with-icon"><UserRound size={18} /><input name="full_name" defaultValue={name} required /></span></label>
            <label>Email address<span className="input-with-icon"><Mail size={18} /><input name="email" type="email" defaultValue={email} required /></span></label>
            <label>Phone<span className="input-with-icon"><Phone size={18} /><input name="phone" defaultValue={profile?.phone || ""} /></span></label>
            <label>Office location<span className="input-with-icon"><MapPin size={18} /><input name="office_location" defaultValue={profile?.office_location || ""} /></span></label>
            <label>Gender<select name="gender" defaultValue={profile?.gender || "not_specified"}><option value="not_specified">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
            <button className="primary-button">Save my information</button>
          </form>
        </article>

        <ChangePasswordForm email={email} />
      </section>
    </main>
  );
}
