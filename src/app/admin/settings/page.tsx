"use client";

import { useState, useEffect } from "react";

interface USPAStatus {
  configured: boolean;
  hasSession: boolean;
  updatedAt: string | null;
  email: string | null;
}

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cookieStr, setCookieStr] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<USPAStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/uspa").then((r) => r.json()).then((s) => {
      setStatus(s);
      if (s.email) setEmail(s.email);
    });
  }, []);

  async function loginWithCredentials() {
    if (!email.trim() || !password.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/uspa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setMessage(`Connected! Verified: ${data.testMember?.firstName} ${data.testMember?.lastName} (${data.testMember?.status})`);
        setPassword("");
        fetch("/api/uspa").then((r) => r.json()).then(setStatus);
      } else {
        setMessage(data.error || "Login failed. Try the cookie method below.");
        setShowAdvanced(true);
      }
    } catch {
      setMessage("Failed to connect");
    }
    setSaving(false);
  }

  async function saveCookies() {
    if (!cookieStr.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/uspa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: cookieStr.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setMessage(`Connected! Verified: ${data.testMember?.firstName} ${data.testMember?.lastName} (${data.testMember?.status})`);
        setCookieStr("");
        fetch("/api/uspa").then((r) => r.json()).then(setStatus);
      } else {
        setMessage(data.error || "Cookies didn't work. They may have expired.");
      }
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/uspa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uspaNumber: "232363" }),
      });
      const data = await res.json();
      if (res.ok && data.member) {
        setMessage(`Connection OK: ${data.member.firstName} ${data.member.lastName} — ${data.member.status}, exp ${data.member.expDate}`);
      } else {
        setMessage(data.error || "Session expired — log in again.");
      }
    } catch {
      setMessage("Connection test failed");
    }
    setTesting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-xl border p-6 max-w-2xl">
        <h2 className="text-lg font-semibold mb-2">USPA Integration</h2>
        <p className="text-gray-600 text-sm mb-4">
          Automatically verify member status, licenses, and expiration dates.
        </p>

        {/* Status */}
        <div className="mb-4 flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${status?.hasSession ? "bg-green-500" : "bg-gray-400"}`} />
          <span className="text-sm font-medium">
            {status?.hasSession ? "Connected" : "Not connected"}
          </span>
          {status?.updatedAt && (
            <span className="text-xs text-gray-500">
              Last synced: {new Date(status.updatedAt + "Z").toLocaleString()}
            </span>
          )}
          {status?.hasSession && (
            <button onClick={testConnection} disabled={testing}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50 ml-auto">
              {testing ? "Testing..." : "Test connection"}
            </button>
          )}
        </div>

        {/* Login form */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            {status?.hasSession ? "Update Login" : "Log in to USPA"}
          </h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">USPA Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">USPA Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={loginWithCredentials}
            disabled={saving || !email.trim() || !password.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Connecting..." : "Connect"}
          </button>
        </div>

        {/* Advanced: cookie paste */}
        <div className="border-t mt-4 pt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {showAdvanced ? "Hide" : "Show"} advanced (paste cookies)
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">
                If login fails (e.g. 2FA enabled), paste cookies from your browser instead.
              </p>
              <textarea
                value={cookieStr}
                onChange={(e) => setCookieStr(e.target.value)}
                placeholder="Paste cookie string from browser DevTools..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={saveCookies}
                disabled={saving || !cookieStr.trim()}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Connecting..." : "Save Cookies"}
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className={`mt-4 text-sm px-3 py-2 rounded ${message.includes("OK") || message.includes("Connected") || message.includes("Verified") ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
