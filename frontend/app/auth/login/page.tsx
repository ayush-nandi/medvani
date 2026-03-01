"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "../../../firebaseConfig";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase auth is not initialized. Check NEXT_PUBLIC_FIREBASE_* vars.");
      await signInWithEmailAndPassword(auth, email, password);
      document.cookie = "medvani_auth=1; Path=/; Max-Age=2592000; SameSite=Lax";
      router.push("/chat");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase auth is not initialized. Check NEXT_PUBLIC_FIREBASE_* vars.");
      await signInWithPopup(auth, new GoogleAuthProvider());
      document.cookie = "medvani_auth=1; Path=/; Max-Age=2592000; SameSite=Lax";
      router.push("/chat");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email first to reset password.");
      return;
    }
    try {
      if (!auth) throw new Error("Firebase auth is not initialized. Check NEXT_PUBLIC_FIREBASE_* vars.");
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Password reset email sent.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#10b98122,transparent_35%),radial-gradient(circle_at_80%_80%,#10b9811a,transparent_35%),#121212] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-[650px] w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#171717] shadow-2xl shadow-black/40"
      >
        <section className="relative hidden w-[45%] overflow-hidden md:block">
          <img
            src="/medvani-login-banner.svg"
            alt="MedVani - Indian Health AI Chatbot"
            className="h-full w-full object-cover"
          />
        </section>

        <section className="flex flex-1 flex-col justify-center bg-[#171717] px-6 py-10 md:px-16 md:py-12">
          <div className="mb-8">
            <h1 className="mb-3 text-3xl font-semibold text-zinc-100">Welcome back to MedVani</h1>
            <p className="text-sm text-zinc-400">
              Access your AI-powered health assistant and personalized wellness dashboard.
            </p>
          </div>

          <form onSubmit={onLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="alex.jordan@gmail.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Password</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 pr-11 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Forgot password?
            </button>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {info && <p className="text-sm text-emerald-400">{info}</p>}

            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-3.5 font-medium text-black transition-colors hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#171717] px-4 text-xs text-zinc-500">OR</span>
            </div>
          </div>

          <button
            disabled={loading}
            type="button"
            onClick={onGoogle}
            className="mb-8 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="font-medium text-emerald-400 hover:text-emerald-300">
              Sign up
            </Link>
          </p>
        </section>
      </motion.div>
    </div>
  );
}
