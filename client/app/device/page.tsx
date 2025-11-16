/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { authClient } from "@/lib/auth-client";
import { ShieldAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react";

const DeviceAuthorizationPage = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [userCode, setUserCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Format the code: remove dashes and convert to uppercase
      const formattedCode = userCode.trim().replace(/-/g, "").toUpperCase();
      // Check if the code is valid using GET /device endpoint
      const response = await authClient.device({
        query: { user_code: formattedCode },
      });

      if (response.data) {
        // Redirect to approval page
        router.push(`/approve?user_code=${formattedCode}`);
      }
    } catch (err) {
      setError("Invalid or expired code");
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md">
        {/* Header Section */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="p-3 rounded-lg border-2 border-dashed border-zinc-700">
            <ShieldAlert className="w-8 h-8 text-yellow-300" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Device Authorization</h1>
            <p className="text-muted-foreground">Enter your device code to continue</p>
          </div>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="border-2 border-dashed border-zinc-700 rounded-xl p-8 bg-zinc-950 backdrop-blur-sm"
        >
          <div className="space-y-6">
            {/* Code Input */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
                Device Code
              </label>
              <input
                id="code"
                type="text"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                placeholder="XXXXXXXX"
                maxLength={8}
                className="w-full px-4 py-3 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-lg text-white placeholder-muted-foreground focus:outline-none focus:border-zinc-600 font-mono text-center text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground mt-2">Find this code on the device you want to authorize</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-950 border border-red-900 text-red-200 text-sm">{error}</div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || userCode.length < 8}
              className="w-full py-3 px-4 bg-zinc-100 text-zinc-950 font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Verifying..." : "Continue"}
            </button>

            {/* Info Box */}
            <div className="p-4 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-lg">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This code is unique to your device and will expire shortly. Keep it confidential and never share it with
                anyone.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
export default DeviceAuthorizationPage