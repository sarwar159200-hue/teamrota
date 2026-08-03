"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.replace("/dashboard?welcome=1");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <div className="brand-content">
          <Image
            src="/miran-energy-logo.png"
            width={500}
            height={170}
            className="miran-logo"
            alt="Miran Energy Ltd"
            priority
          />
          <div className="auth-brand-copy">
            <h1>TeamRota</h1>
            <h2>Workforce Management System</h2>
            <p>A smarter way to manage your workforce, organization, rotas and leave.</p>
          </div>
        </div>
        <p className="copyright">© 2026 Miran Energy Ltd. All rights reserved.</p>
      </section>

      <section className="auth-form-panel">
        <form className="auth-card" onSubmit={handleLogin}>
          <div>
            <p className="auth-kicker">WELCOME BACK</p>
            <h2>Sign in to your account</h2>
          </div>

          <label>
            Email address
            <span className="input-with-icon">
              <Mail size={19} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Type your email address"
                autoComplete="email"
                required
              />
            </span>
          </label>

          <label>
            Password
            <span className="input-with-icon">
              <LockKeyhole size={19} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>

          <Link href="/forgot-password" className="forgot-link">Forgot your password?</Link>
          {message && <div className="error-box">{message}</div>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="auth-help">Need help? Contact your system administrator.</p>
        </form>
      </section>
    </main>
  );
}
