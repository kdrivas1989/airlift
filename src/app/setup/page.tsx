"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } else {
      setError(data.error || "Failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2">AirLIFT</h1>
        <p className="text-gray-600 text-center mb-6">Set up your account</p>

        {success ? (
          <div className="bg-green-50 text-green-700 px-4 py-4 rounded-xl text-center">
            <p className="font-medium mb-1">You're all set!</p>
            <p className="text-sm">Redirecting to login...</p>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
              <p className="text-sm text-gray-600">Enter the email you used to book, then set a password to access your account.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="your@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Choose a Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  required className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                {loading ? "Setting up..." : "Set Up Account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
