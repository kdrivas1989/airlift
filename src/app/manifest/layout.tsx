"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AuthUser {
  staffId: number;
  name: string;
  role: string;
}

export default function ManifestLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setUser(data);
        setChecking(false);
      })
      .catch(() => { router.push("/login"); });
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
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/manifest" className="font-bold text-lg">AirLIFT</Link>
            <Link href="/manifest" className={`text-sm hover:text-white ${pathname === "/manifest" ? "text-white" : "text-gray-400"}`}>
              Dashboard
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin/aircraft" className={`text-sm hover:text-white ${pathname.startsWith("/admin") ? "text-white" : "text-gray-400"}`}>
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-400">{user.name} ({user.role})</span>}
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">Logout</button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
