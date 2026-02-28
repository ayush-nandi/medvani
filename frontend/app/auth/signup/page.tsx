"use client";

import { motion } from "framer-motion";
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "../../../firebaseConfig";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [promoConsent, setPromoConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase auth is not initialized. Check NEXT_PUBLIC_FIREBASE_* vars.");
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      document.cookie = "medvani_auth=1; Path=/; Max-Age=2592000; SameSite=Lax";
      router.push("/chat");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError("");
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

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#121212] px-4">
      <motion.form
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSignup}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#1a1a1a] p-6"
      >
        <h1 className="text-2xl font-semibold text-white">Create account</h1>
        <p className="mt-1 text-sm text-zinc-400">Sign up to start using MedVani.</p>

        <div className="mt-5 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm Password" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={promoConsent} onChange={(e) => setPromoConsent(e.target.checked)} />
            I agree to receive promotional emails
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button disabled={loading} type="submit" className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60">
          {loading ? "Creating..." : "Sign Up"}
        </button>
        <button disabled={loading} type="button" onClick={onGoogle} className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60">
          Continue with Google
        </button>

        <p className="mt-4 text-center text-sm text-zinc-400">
          Already have an account? <Link href="/auth/login" className="text-emerald-400">Login</Link>
        </p>
      </motion.form>
    </div>
  );
}
