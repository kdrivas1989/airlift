"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AuthUser {
  staffId: number;
  name: string;
  role: string;
  isStaff: boolean;
  personType: string;
}

export default function JumpLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => {
        if (r.status === 401) { router.push("/login?next=/jump"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setUser(data);
        setChecking(false);
      })
      .catch(() => { router.push("/login?next=/jump"); });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  if (checking) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
          <a href="/jump" className="font-bold text-lg">AirLIFT</a>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-400">{user.name}</span>}
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">Logout</button>
          </div>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto p-4">{children}</main>
    </div>
  );
}
