"use client";

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();

      formData.append("username", email);
      formData.append("password", password);

      const response = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      localStorage.setItem("access_token", data.access_token);

    const meResponse = await fetch(
    "http://127.0.0.1:8000/auth/me",
    {
        headers: {
        Authorization: `Bearer ${data.access_token}`,
        },
    }
    );

    const meData = await meResponse.json();

if (!meResponse.ok) {
  throw new Error(meData.detail || "Failed to get user information");
}

localStorage.setItem("user_role", meData.role);

router.push("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to login"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-blue-600">
          EduOS
        </h1>

        <p className="mt-2 text-slate-600">
          Login to your account
        </p>

        <form onSubmit={handleLogin} className="mt-8">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}