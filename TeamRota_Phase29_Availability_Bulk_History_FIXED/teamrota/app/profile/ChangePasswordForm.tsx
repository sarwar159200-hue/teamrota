"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = { email: string };

export default function ChangePasswordForm({ email }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const strength = useMemo(() => {
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[a-z]/.test(newPassword)) score++;
    if (/\d/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  }, [newPassword]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword) return setError("Enter your current password.");
    if (newPassword.length < 8) return setError("The new password must contain at least 8 characters.");
    if (newPassword === currentPassword) return setError("Your new password must be different from your current password.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");

    setLoading(true);
    const supabase = createClient();

    // Re-authenticate first. This prevents expired-session and recent-login errors.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setLoading(false);
      setError("Your current password is incorrect. Please try again.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      data: { force_password_change: false },
    });

    setLoading(false);
    if (updateError) {
      setError(updateError.message || "The password could not be updated.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("Your password has been updated successfully.");
  }

  return (
    <article className="panel security-settings-card">
      <div className="security-card-heading">
        <span className="security-icon"><ShieldCheck size={22} /></span>
        <div>
          <p className="eyebrow">ACCOUNT SECURITY</p>
          <h2>Change your password</h2>
          <p>Confirm your current password, then create a stronger replacement.</p>
        </div>
      </div>

      <form className="settings-form password-renew-form" onSubmit={handleSubmit}>
        <label>
          Current password
          <span className="input-with-icon secure-input">
            <KeyRound size={18} />
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your current password"
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowCurrent((value) => !value)} aria-label={showCurrent ? "Hide current password" : "Show current password"}>
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <label>
          New password
          <span className="input-with-icon secure-input">
            <KeyRound size={18} />
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowNew((value) => !value)} aria-label={showNew ? "Hide new password" : "Show new password"}>
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className="password-strength" aria-label={`Password strength ${strength} of 5`}>
          {[1, 2, 3, 4, 5].map((item) => <span key={item} className={item <= strength ? "active" : ""} />)}
        </div>
        <small className="password-guidance">Use uppercase and lowercase letters, a number, and a symbol.</small>

        <label>
          Confirm new password
          <span className="input-with-icon secure-input">
            <KeyRound size={18} />
            <input
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Repeat your new password"
              minLength={8}
              required
            />
          </span>
        </label>

        {error && <div className="form-alert error"><span>!</span>{error}</div>}
        {success && <div className="form-alert success"><CheckCircle2 size={18} />{success}</div>}

        <button className="primary-button secure-submit" type="submit" disabled={loading}>
          {loading ? <><Loader2 className="spin" size={18} />Updating password…</> : <><ShieldCheck size={18} />Update password securely</>}
        </button>
      </form>
    </article>
  );
}
