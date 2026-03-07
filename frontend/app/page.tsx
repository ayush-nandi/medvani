"use client";

import { motion } from "framer-motion";
import { MoveRight, Shield, Languages, Activity, Brain } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const features = [
  { icon: Brain,     label: "AI Clinical Reasoning"    },
  { icon: Languages, label: "10+ Indian Languages"     },
  { icon: Activity,  label: "Multimodal Input"         },
  { icon: Shield,    label: "Privacy First"            },
];

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
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/auth/login"
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
              >
                Login
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/auth/signup"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-zinc-100"
              >
                Sign Up
              </Link>
            </motion.div>
          </div>
        </header>

        <motion.section
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-1 flex-col items-center justify-center text-center"
        >
          <motion.h1
            variants={fadeUp}
            className="bg-gradient-to-r from-white to-emerald-300 bg-clip-text text-8xl font-extrabold tracking-tight text-transparent"
          >
            MedVani
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-7 max-w-3xl whitespace-pre-line text-xl leading-relaxed text-zinc-400"
          >
            {`Multimodal clinical intelligence for text, voice, and medical imagery.\nGrounded reasoning with memory-aware context and language continuity.\nBuilt for safe, adaptive health conversations across care journeys.`}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10">
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-3 font-semibold text-black transition-colors hover:bg-zinc-100"
            >
              Get Started
              <motion.span
                animate={{ x: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, type: "spring", stiffness: 170 }}
              >
                <MoveRight size={18} />
              </motion.span>
            </button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-400 backdrop-blur-sm"
              >
                <Icon size={14} className="text-emerald-400" />
                {label}
              </div>
            ))}
          </motion.div>
        </motion.section>
      </div>
    </motion.main>
  );
}
