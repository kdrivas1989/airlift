"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (res.ok) {
      setSent(true);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to send");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2">AirLIFT</h1>
        <p className="text-gray-600 text-center mb-6">Reset your password</p>

        {sent ? (
          <div className="bg-green-50 text-green-700 px-4 py-4 rounded-xl text-center">
            <p className="font-medium mb-1">Check your email</p>
            <p className="text-sm">If an account exists for {email}, we sent a password reset link.</p>
            <Link href="/login" className="text-blue-600 hover:underline text-sm mt-3 inline-block">Back to login</Link>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="your@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" autoFocus />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">
              <Link href="/login" className="text-blue-600 hover:underline">Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
