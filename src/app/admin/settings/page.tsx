"use client";

import { useState, useEffect } from "react";

interface USPAStatus {
  configured: boolean;
  hasSession: boolean;
  updatedAt: string | null;
  email: string | null;
}

export default function SettingsPage() {
  const [cookieStr, setCookieStr] = useState("");
  const [status, setStatus] = useState<USPAStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/uspa").then((r) => r.json()).then(setStatus);
  }, []);

  async function saveCookies() {
    if (!cookieStr.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/uspa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: cookieStr.trim(), email: "", password: "" }),
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
        setMessage(data.error || "Session expired — paste new cookies.");
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
          Paste your browser cookies from uspa.org to connect.
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
        </div>

        {status?.hasSession && (
          <button onClick={testConnection} disabled={testing}
            className="mb-4 text-sm text-blue-600 hover:underline disabled:opacity-50">
            {testing ? "Testing..." : "Test connection"}
          </button>
        )}

        {/* Cookie paste */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            {status?.hasSession ? "Update Session" : "Connect to USPA"}
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">How to get cookies:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Log into <a href="https://www.uspa.org/Login" target="_blank" className="text-blue-600 hover:underline">uspa.org</a></li>
              <li>Open DevTools (Cmd+Option+I)</li>
              <li>Go to Network tab, click any request</li>
              <li>Find "Cookie" in Request Headers</li>
              <li>Copy the full value and paste below</li>
            </ol>
          </div>
          <textarea
            value={cookieStr}
            onChange={(e) => setCookieStr(e.target.value)}
            placeholder="Paste cookie string here..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={saveCookies}
            disabled={saving || !cookieStr.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Connecting..." : "Save & Connect"}
          </button>
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
