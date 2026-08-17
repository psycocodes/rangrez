"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Check,
  Ban,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from "lucide-react";

import type { User } from "@/lib/types";

type AuthTab = "register" | "login";
type VerificationState = "magic_link" | "verified" | "timed_out" | null;

export function AuthExperience({
  initialUser,
  googleAvailable = true,
  oauthError,
}: {
  initialUser: User | null;
  googleAvailable?: boolean;
  oauthError?: string;
}) {
  const router = useRouter();

  const [authTab, setAuthTab] = useState<AuthTab>("register");

  // Registration & Login state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(oauthError ?? null);

  // Verification Modal state
  const [verificationModal, setVerificationModal] = useState<VerificationState>(null);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  /* ── Auth Handlers ── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setAuthError("Full name is required.");
    if (!email.trim() || !email.includes("@")) return setAuthError("Valid email required.");
    if (password.length < 8) return setAuthError("8 characters minimum.");
    if (!agreeTerms) return setAuthError("Must accept terms & privacy policy.");

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");

      setRegisteredEmail(email);
      setVerificationModal("magic_link");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setAuthError("Enter your email.");
    if (!password) return setAuthError("Enter your password.");

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "email_not_confirmed") {
          setRegisteredEmail(email);
          setVerificationModal("magic_link");
          return;
        }
        throw new Error(data.error || "Invalid email or password.");
      }

      if (data.hasAvatar) {
        router.push("/trialroom");
        router.refresh();
      } else {
        router.push("/onboarding");
        router.refresh();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = "/api/auth/google";
  };

  /* ── Verification Simulation & Resend ── */
  const handleSimulateVerification = async () => {
    try {
      await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_simulated",
          email: registeredEmail || email,
        }),
      });
      setVerificationModal("verified");
      setTimeout(() => {
        router.push("/onboarding");
        router.refresh();
      }, 1200);
    } catch {
      setVerificationModal("timed_out");
    }
  };

  const handleResendMagicLink = async () => {
    setResendStatus("Resending magic link...");
    try {
      await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend",
          email: registeredEmail || email,
        }),
      });
      setResendStatus("✓ New link dispatched to inbox!");
      setTimeout(() => setResendStatus(null), 3000);
    } catch {
      setResendStatus("Could not resend.");
    }
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center bg-[#F4EFE6] text-[#14120E] selection:bg-[#FFDE59] overflow-hidden p-3 sm:p-5">
      {/* Background Texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "url('/assets/backgrounds/wardrobe-background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* ═════════════════════════════════════════════════════════════════════
       *  AUTHENTICATION CARD (Register / Login / Google) - ZERO NAVBAR
       * ═════════════════════════════════════════════════════════════════════ */}
      <motion.div
        key="auth-card"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-[430px] rounded-3xl border-[3.5px] border-[#14120E] bg-white p-6 sm:p-8 shadow-[8px_8px_0px_#14120E]"
      >
        {/* Header Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border-[2.5px] border-[#14120E] bg-[#F4EFE6] p-1.5 shadow-[3px_3px_0px_#14120E]">
          <button
            type="button"
            onClick={() => {
              setAuthTab("register");
              setAuthError(null);
            }}
            className={`flex items-center justify-center rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              authTab === "register"
                ? "border-2 border-[#14120E] bg-[#FFDE59] text-[#14120E] shadow-[2px_2px_0px_#14120E]"
                : "text-[#14120E]/70 hover:text-[#14120E]"
            }`}
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab("login");
              setAuthError(null);
            }}
            className={`flex items-center justify-center rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              authTab === "login"
                ? "border-2 border-[#14120E] bg-[#FFDE59] text-[#14120E] shadow-[2px_2px_0px_#14120E]"
                : "text-[#14120E]/70 hover:text-[#14120E]"
            }`}
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            Login
          </button>
        </div>

        {/* Title */}
        <div className="mt-5">
          <h1
            className="text-3xl font-black uppercase tracking-tight text-[#14120E]"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            {authTab === "register" ? "Create Account" : "Sign In"}
          </h1>
          <p
            className="mt-1 text-xs text-[#14120E]/70 font-medium"
            style={{ fontFamily: "var(--font-instrument-sans), sans-serif" }}
          >
            {authTab === "register"
              ? "Enter your details to create your wardrobe profile."
              : "Access your saved avatars, measurements, and fitted looks."}
          </p>
        </div>

        {/* Error Banner */}
        {authError && (
          <div className="mt-3 rounded-xl border-2 border-[#14120E] bg-[#FF5A5F] p-2.5 text-xs font-bold text-white shadow-[2px_2px_0px_#14120E]">
            {authError}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={authTab === "register" ? handleRegister : handleLogin}
          className="mt-4 space-y-3.5"
        >
          {authTab === "register" && (
            <div>
              <label
                className="block text-[11px] font-bold uppercase tracking-wider text-[#14120E]"
                style={{ fontFamily: "var(--font-clash), sans-serif" }}
              >
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mohikshit Ghorai"
                className="mt-1 w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3.5 py-2.5 text-xs font-medium text-[#14120E] placeholder:text-[#14120E]/40 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
              />
            </div>
          )}

          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-wider text-[#14120E]"
              style={{ fontFamily: "var(--font-clash), sans-serif" }}
            >
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="mt-1 w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3.5 py-2.5 text-xs font-medium text-[#14120E] placeholder:text-[#14120E]/40 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
            />
          </div>

          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-wider text-[#14120E]"
              style={{ fontFamily: "var(--font-clash), sans-serif" }}
            >
              Password
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border-2 border-[#14120E] bg-[#FAF8F5] px-3.5 py-2.5 pr-10 text-xs font-medium text-[#14120E] placeholder:text-[#14120E]/40 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFDE59]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#14120E]/60 hover:text-[#14120E] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {authTab === "register" ? (
            <label className="flex items-start gap-2 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-2 border-[#14120E] accent-[#14120E]"
              />
              <span className="text-[11px] text-[#14120E]/80 leading-tight font-medium">
                I agree to the Terms of Service & Privacy Policy.
              </span>
            </label>
          ) : (
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-2 border-[#14120E] accent-[#14120E]"
                />
                <span className="text-xs text-[#14120E]/80 font-medium">Remember me</span>
              </label>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#14120E] bg-[#7FE06E] py-3 text-xs font-black uppercase tracking-wider text-[#14120E] shadow-[4px_4px_0px_#14120E] transition-all hover:bg-[#92E883] hover:shadow-[5px_5px_0px_#14120E] hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer disabled:opacity-50"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            {authLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#14120E]" />
                <span>PROCESSING...</span>
              </>
            ) : (
              <>
                <span>{authTab === "register" ? "Create Account" : "Sign In"}</span>
                <ArrowRight className="h-4 w-4 stroke-[3]" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="w-full border-t-2 border-[#14120E]/15" />
          <span
            className="absolute bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-[#14120E]/60"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            OR
          </span>
        </div>

        {/* Google Sign In Button */}
        {googleAvailable && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 rounded-2xl border-[2.5px] border-[#14120E] bg-white py-3 text-xs font-black uppercase tracking-wider text-[#14120E] shadow-[4px_4px_0px_#14120E] transition-all hover:bg-[#FAF8F5] hover:shadow-[5px_5px_0px_#14120E] hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer"
            style={{ fontFamily: "var(--font-clash), sans-serif" }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        )}
      </motion.div>

      {/* ═════════════════════════════════════════════════════════════════════
       *  EMAIL VERIFICATION MODALS (Screenshot 1)
       * ═════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {verificationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl border-[3.5px] border-[#14120E] bg-white p-7 shadow-[8px_8px_0px_#14120E] text-center"
            >
              {/* MODAL 1: Click on the Magic Link in your Mail to verify */}
              {verificationModal === "magic_link" && (
                <div className="flex flex-col items-center space-y-4 py-2">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#14120E] bg-[#FFDE59] shadow-[3px_3px_0px_#14120E]">
                    <Mail className="h-10 w-10 text-[#14120E] stroke-[2]" />
                  </div>

                  <p
                    className="text-base font-bold text-[#14120E] leading-snug"
                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                  >
                    Click on the Magic Link in your Mail to verify
                  </p>

                  <div className="w-full pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={handleSimulateVerification}
                      className="w-full rounded-2xl border-[2.5px] border-[#14120E] bg-[#7FE06E] py-2.5 text-xs font-black uppercase tracking-wider text-[#14120E] shadow-[3px_3px_0px_#14120E] hover:bg-[#92E883] hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer transition-all"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      ⚡ Instant Verify
                    </button>

                    <button
                      type="button"
                      onClick={handleResendMagicLink}
                      className="w-full rounded-xl border-2 border-[#14120E] bg-white py-2 text-[11px] font-bold uppercase text-[#14120E] shadow-[2px_2px_0px_#14120E] hover:bg-[#FAF8F5] cursor-pointer"
                      style={{ fontFamily: "var(--font-clash), sans-serif" }}
                    >
                      Resend Mail
                    </button>

                    {resendStatus && (
                      <p className="text-[10px] font-bold text-[#1E3A8A]">{resendStatus}</p>
                    )}
                  </div>
                </div>
              )}

              {/* MODAL 2: Account Verified */}
              {verificationModal === "verified" && (
                <div className="flex flex-col items-center space-y-3 py-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#14120E] bg-[#7FE06E] shadow-[3px_3px_0px_#14120E]">
                    <Check className="h-10 w-10 text-[#14120E] stroke-[3]" />
                  </div>

                  <h3
                    className="text-lg font-black uppercase tracking-tight text-[#14120E]"
                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                  >
                    Account Verified
                  </h3>

                  <p className="text-xs text-[#14120E]/70 font-medium">Redirecting to Dashboard</p>
                </div>
              )}

              {/* MODAL 3: Request Timed Out */}
              {verificationModal === "timed_out" && (
                <div className="flex flex-col items-center space-y-3 py-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#14120E] bg-[#FF5A5F] shadow-[3px_3px_0px_#14120E]">
                    <Ban className="h-10 w-10 text-white stroke-[2.5]" />
                  </div>

                  <h3
                    className="text-lg font-black uppercase tracking-tight text-[#14120E]"
                    style={{ fontFamily: "var(--font-clash), sans-serif" }}
                  >
                    Request Timed Out
                  </h3>

                  <p className="text-xs text-[#14120E]/70 font-medium">Redirecting to Auth</p>

                  <button
                    type="button"
                    onClick={() => setVerificationModal(null)}
                    className="mt-1 w-full rounded-2xl border-2 border-[#14120E] bg-[#FFDE59] py-2 text-xs font-black uppercase text-[#14120E] shadow-[2px_2px_0px_#14120E]"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
