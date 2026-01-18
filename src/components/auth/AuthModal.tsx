"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn, signUp } from "@/app/auth/actions";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "signup";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "login" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"login" | "signup">(defaultTab);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset modal state when opened */
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, defaultTab]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    },
    [onClose, loading]
  );

  // Lock body scroll and add escape listener
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleEscape]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  // Handle login submit
  async function handleLogin(formData: FormData) {
    setError(null);
    setLoading(true);

    const result = await signIn(formData);

    // If we get here, there was an error (success redirects)
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  // Handle signup submit
  async function handleSignup(formData: FormData) {
    setError(null);
    setLoading(true);

    const result = await signUp(formData);

    // If we get here, there was an error (success redirects)
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg shadow-xl w-full max-w-md relative">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] disabled:opacity-50"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Tab toggle */}
        <div className="flex border-b border-[rgb(var(--color-border-primary))]">
          <button
            onClick={() => {
              setActiveTab("login");
              setError(null);
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "login"
                ? "text-[rgb(var(--color-accent-primary))] border-b-2 border-[rgb(var(--color-accent-primary))]"
                : "text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => {
              setActiveTab("signup");
              setError(null);
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "signup"
                ? "text-[rgb(var(--color-accent-primary))] border-b-2 border-[rgb(var(--color-accent-primary))]"
                : "text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form content */}
        <div className="p-6">
          <h2 id="auth-modal-title" className="text-xl font-bold mb-4">
            {activeTab === "login" ? "Welcome Back" : "Create an Account"}
          </h2>

          {activeTab === "login" ? (
            <form action={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="modal-login-email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="modal-login-email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))]"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="modal-login-password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="modal-login-password"
                  name="password"
                  type="password"
                  required
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))]"
                  placeholder="Your password"
                />
              </div>

              {error && (
                <div className="p-3 bg-[rgb(var(--color-error-bg))] border border-[rgb(var(--color-error-border))] text-[rgb(var(--color-error-text))] rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>
          ) : (
            <form action={handleSignup} className="space-y-4">
              <div>
                <label htmlFor="modal-signup-displayName" className="block text-sm font-medium mb-1">
                  <span className="flex items-center gap-1">
                    Your Name
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 text-xs text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-bg-tertiary))] rounded-full cursor-help"
                      title="This is how your bracket will be identified on the public leaderboard."
                    >
                      ?
                    </span>
                  </span>
                </label>
                <input
                  id="modal-signup-displayName"
                  name="displayName"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))]"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label htmlFor="modal-signup-email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="modal-signup-email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))]"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="modal-signup-password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="modal-signup-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))]"
                  placeholder="At least 6 characters"
                />
              </div>

              {error && (
                <div className="p-3 bg-[rgb(var(--color-error-bg))] border border-[rgb(var(--color-error-border))] text-[rgb(var(--color-error-text))] rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Sign Up"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
