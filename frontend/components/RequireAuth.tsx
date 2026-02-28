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
      <div className="flex h-[100dvh] items-center justify-center bg-[#121212]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
