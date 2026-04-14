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
  const [status, setStatus] = useState<USPAStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/uspa")
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  async function saveCredentials() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/uspa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(cookieStr ? { cookies: cookieStr } : {}) }),
      });
      const data = await res.json();
      if (data.valid) {
        setMessage(`Connected! Test: ${data.testMember?.firstName} ${data.testMember?.lastName} (${data.testMember?.status})`);
        setEmail("");
        setPassword("");
        fetch("/api/uspa").then((r) => r.json()).then(setStatus);
      } else {
        setMessage(data.error || "Credentials saved but login failed.");
      }
    } catch {
      setMessage("Failed to save credentials");
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
        setMessage(`Connection OK: ${data.member.firstName} ${data.member.lastName} — ${data.member.status}, expires ${data.member.expDate}`);
      } else {
        setMessage(data.error || "Test failed — session may have expired.");
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
          Connect to USPA to automatically verify member status, license levels, and expiration dates.
          The system logs in automatically and refreshes the session when needed.
        </p>

        <div className="mb-4 flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${status?.configured ? (status.hasSession ? "bg-green-500" : "bg-yellow-500") : "bg-gray-400"}`} />
          <span className="text-sm font-medium">
            {!status?.configured
              ? "Not configured"
              : status.hasSession
              ? "Connected"
              : "Credentials saved — session not yet established"}
          </span>
          {status?.email && (
            <span className="text-xs text-gray-500">({status.email})</span>
          )}
          {status?.updatedAt && (
            <span className="text-xs text-gray-500">
              Session: {new Date(status.updatedAt + "Z").toLocaleString()}
            </span>
          )}
        </div>

        {status?.configured && (
          <button
            onClick={testConnection}
            disabled={testing}
            className="mb-4 text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test connection"}
          </button>
        )}

        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700">
            {status?.configured ? "Update Credentials" : "USPA Login"}
          </h3>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-uspa-email@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="border-t pt-3 mt-3">
            <label className="block text-sm text-gray-600 mb-1">Browser Cookies (optional — paste from DevTools if login fails)</label>
            <textarea
              value={cookieStr}
              onChange={(e) => setCookieStr(e.target.value)}
              placeholder="Paste cookie string from browser DevTools..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Or drag this to your bookmarks bar:{" "}
              <a
                href={`javascript:void(fetch('https://airlift.kd-evolution.com/api/uspa/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookies:document.cookie})}).then(r=>r.json()).then(d=>alert(d.valid?'USPA cookies synced to AirLIFT!':'Sync failed: '+(d.error||'unknown'))).catch(()=>alert('Failed to connect to AirLIFT')))`}
                className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 cursor-grab"
                onClick={(e) => { e.preventDefault(); alert("Drag this to your bookmarks bar, then click it while logged into uspa.org"); }}
              >
                Sync USPA to AirLIFT
              </a>
            </p>
          </div>

          <button
            onClick={saveCredentials}
            disabled={saving || (!cookieStr.trim() && (!email.trim() || !password.trim()))}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Connecting..." : "Save & Connect"}
          </button>
        </div>

        {message && (
          <div className={`mt-4 text-sm px-3 py-2 rounded ${message.includes("OK") || message.includes("Connected") ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
