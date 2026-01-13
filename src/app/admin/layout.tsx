import { requireAdmin } from "@/components/admin/AdminGuard";
import { signOut } from "@/app/auth/actions";
import Link from "next/link";
import SettingsButton from "@/components/SettingsButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will redirect if not authenticated or not an admin
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-secondary))]">
      {/* Admin Header */}
      <header className="bg-[rgb(var(--color-bg-primary))] border-b border-[rgb(var(--color-border-primary))] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo/Title */}
            <div className="flex items-center gap-3 sm:gap-6">
              <Link href="/admin" className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold">
                  <span className="sm:hidden">Admin</span>
                  <span className="hidden sm:inline">Admin Panel</span>
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-4">
                <Link
                  href="/admin"
                  className="text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] text-sm font-medium"
                >
                  Tournaments
                </Link>
                <Link
                  href="/admin/feedback"
                  className="text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] text-sm font-medium"
                >
                  Feedback
                </Link>
              </nav>
            </div>

            {/* Right side - User info & logout */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Username - hide on mobile */}
              <span className="hidden sm:inline text-sm text-[rgb(var(--color-text-secondary))] truncate max-w-[150px]">
                {profile.display_name || profile.email}
              </span>
              {/* View Site - hide on mobile */}
              <Link
                href="/"
                className="hidden sm:inline text-sm text-[rgb(var(--color-accent-primary))] hover:text-[rgb(var(--color-accent-hover))]"
              >
                View Site
              </Link>
              {/* Settings button - always visible */}
              <SettingsButton />
              {/* Log Out - show icon on mobile, text on desktop */}
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Log out"
                  className="px-2 sm:px-3 py-1.5 text-sm bg-[rgb(var(--color-bg-tertiary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] flex items-center gap-1"
                >
                  <span className="hidden sm:inline">Log Out</span>
                  {/* Logout icon for mobile */}
                  <svg
                    className="w-5 h-5 sm:hidden"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
