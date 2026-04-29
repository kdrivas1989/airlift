"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AuthUser {
  staffId: number;
  name: string;
  role: string;
  isStaff: boolean;
}

const NAV_ITEMS = [
  { href: "/manifest/reception", label: "Reception" },
  { href: "/manifest/instructors", label: "Instructors" },
  { href: "/manifest", label: "Manifest", exact: true },
  { href: "/manifest/block-jumps", label: "Block Jumps" },
  { href: "/manifest/accounts", label: "Accounts" },
];

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

  const isManifestPage = pathname === "/manifest" || pathname.startsWith("/manifest/loads");

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <nav className="bg-gray-900 text-white shrink-0">
        <div className="px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-1">
            <a href="/manifest" className="font-bold text-lg mr-4">AirLIFT</a>
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <a key={item.href} href={item.href}
                  className={`px-3 py-1.5 rounded text-sm transition ${active ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                  {item.label}
                </a>
              );
            })}
            {user?.role === "admin" && (
              <a href="/admin/aircraft" className="px-3 py-1.5 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800">
                Admin
              </a>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-400">{user.name}</span>}
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">Logout</button>
          </div>
        </div>
      </nav>
      {isManifestPage ? (
        <div className="flex-1 overflow-hidden">{children}</div>
      ) : (
        <main className="flex-1 overflow-auto p-6">{children}</main>
      )}
    </div>
  );
}
