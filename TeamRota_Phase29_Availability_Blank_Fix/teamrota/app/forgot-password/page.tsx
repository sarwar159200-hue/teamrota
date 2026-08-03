"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setMessage("A secure password-reset link has been sent to your email address.");
    setLoading(false);
  }

  return (
    <main className="simple-auth-shell">
      <form className="auth-card compact-auth-card" onSubmit={submit}>
        <div>
          <p className="auth-kicker">ACCOUNT RECOVERY</p>
          <h2>Reset your password</h2>
          <p className="muted">Enter your registered work email. Supabase will send you a secure reset link.</p>
        </div>
        <label>
          Email address
          <span className="input-with-icon">
            <Mail size={19} />
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </span>
        </label>
        {message && <div className="success-box">{message}</div>}
        {error && <div className="error-box">{error}</div>}
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/login" className="center-link">Back to sign in</Link>
      </form>
    </main>
  );
}
