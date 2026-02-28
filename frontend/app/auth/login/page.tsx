"use client";

import { motion } from "framer-motion";
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#121212] px-4">
      <motion.form
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onLogin}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#1a1a1a] p-6"
      >
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-400">Login to continue to MedVani.</p>

        <div className="mt-5 space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
        </div>

        <button type="button" onClick={onForgotPassword} className="mt-2 text-xs text-emerald-400">
          Forgot Password?
        </button>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {info && <p className="mt-3 text-sm text-emerald-400">{info}</p>}

        <button disabled={loading} type="submit" className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60">
          {loading ? "Logging in..." : "Login"}
        </button>
        <button disabled={loading} type="button" onClick={onGoogle} className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60">
          Continue with Google
        </button>

        <p className="mt-4 text-center text-sm text-zinc-400">
          New user? <Link href="/auth/signup" className="text-emerald-400">Sign Up</Link>
        </p>
      </motion.form>
    </div>
  );
}
