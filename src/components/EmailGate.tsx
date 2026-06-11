"use client";

import { useEffect, useState } from "react";

const EMAIL_KEY = "wc2026_email";
const USERNAME_KEY = "wc2026_username";
const ALLOWED_DOMAIN = "@citizensbank.com";

export default function EmailGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_KEY);
    if (storedEmail) setUnlocked(true);
    setChecked(true);
  }, []);

  const handleSubmit = () => {
    const trimmed = email.trim();

    if (!trimmed.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      setError("Please use your @citizensbank.com email address");
      return;
    }

    localStorage.setItem(EMAIL_KEY, trimmed);
    localStorage.setItem(USERNAME_KEY, trimmed.split("@")[0]);
    setUnlocked(true);
  };

  if (!checked) return null;

  if (!unlocked) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#003B2B]">
        <div className="mx-4 w-full max-w-sm rounded-lg border border-[#00573F] bg-[#002820] p-8 text-center shadow-2xl">
          <img src="/citizens-logo.png" alt="Citizens" className="mx-auto mb-4 h-12 w-auto" />
          <h1 className="font-[family-name:var(--font-heading)] text-3xl tracking-wide text-[#FFD700]">
            CFG World Cup Predictor
          </h1>
          <p className="mt-2 text-sm text-white">Sign in with your Citizens Bank email</p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="you@citizensbank.com"
            className="mt-6 w-full rounded-md border border-[#00573F] bg-[#003B2B] px-3 py-2 text-center text-white placeholder-white/40 focus:border-[#00A651] focus:outline-none"
          />

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            className="mt-4 w-full rounded-md bg-[#00A651] px-4 py-2 font-semibold text-white transition hover:bg-[#00A651]/80"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
