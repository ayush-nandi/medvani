"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { auth } from "../firebaseConfig";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!auth) {
      router.replace("/auth/signup");
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/auth/signup");
        return;
      }
      document.cookie = "medvani_auth=1; Path=/; Max-Age=2592000; SameSite=Lax";
      setChecking(false);
    });
    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-[#121212]">
        <span className="bg-gradient-to-r from-white to-emerald-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
          MedVani
        </span>
        <div className="flex items-center gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
