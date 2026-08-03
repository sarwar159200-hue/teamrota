"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) return setMessage("Password must contain at least 8 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="simple-auth-shell">
      <form className="auth-card compact-auth-card" onSubmit={submit}>
        <div>
          <p className="auth-kicker">SECURE PASSWORD</p>
          <h2>Create a new password</h2>
          <p className="muted">Choose a strong password that you have not used before.</p>
        </div>
        <label>New password<span className="input-with-icon"><LockKeyhole size={19}/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></span></label>
        <label>Confirm password<span className="input-with-icon"><LockKeyhole size={19}/><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></span></label>
        {message && <div className="error-box">{message}</div>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? "Updating…" : "Update password"}</button>
      </form>
    </main>
  );
}
