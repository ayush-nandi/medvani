"use client";

import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  async function onGetStarted() {
    setExiting(true);
    await new Promise((resolve) => setTimeout(resolve, 260));
    router.push("/auth/signup");
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className="h-[100dvh] w-full bg-[radial-gradient(circle_at_20%_20%,#10b98122,transparent_35%),radial-gradient(circle_at_80%_80%,#10b9811a,transparent_35%),#121212]"
    >
      <div className="container mx-auto flex h-full w-full max-w-screen-2xl flex-col px-4">
        <header className="flex items-center justify-end py-6">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.05 }}>
              <Link
                href="/auth/login"
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200"
              >
                Login
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }}>
              <Link
                href="/auth/signup"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                Sign Up
              </Link>
            </motion.div>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="bg-gradient-to-r from-white to-emerald-300 bg-clip-text text-8xl font-extrabold tracking-tight text-transparent">
            MedVani
          </h1>
          <p className="mt-7 max-w-3xl whitespace-pre-line text-xl leading-relaxed text-zinc-300">
            {`Multimodal clinical intelligence for text, voice, and medical imagery.\nGrounded reasoning with memory-aware context and language continuity.\nBuilt for safe, adaptive health conversations across care journeys.`}
          </p>

          <button
            type="button"
            onClick={onGetStarted}
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-white px-7 py-3 font-semibold text-black"
          >
            Get Started
            <motion.span
              animate={{ x: [0, 7, 0] }}
              transition={{ repeat: Infinity, duration: 1.35, type: "spring", stiffness: 180 }}
            >
              <MoveRight size={18} />
            </motion.span>
          </button>
        </section>
      </div>
    </motion.main>
  );
}
