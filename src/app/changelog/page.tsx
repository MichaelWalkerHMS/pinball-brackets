import Link from "next/link";
import ResponsiveHeader from "@/components/ResponsiveHeader";

export default function ChangelogPage() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <Link href="/" className="text-[rgb(var(--color-accent-primary))] hover:underline">
          <span className="hidden sm:inline">&larr; Back to Home</span>
          <span className="sm:hidden">&larr; Back</span>
        </Link>
        <div className="flex-shrink-0">
          <ResponsiveHeader />
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Changelog</h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1.0.1</h2>
          <ul className="list-disc list-inside text-[rgb(var(--color-text-secondary))] space-y-1">
            <li>Implemented initial services for calling Match Play API to build tournaments and import results</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1.0</h2>
          <ul className="list-disc list-inside text-[rgb(var(--color-text-secondary))] space-y-1">
            <li>Initial launch with Michigan Open and Women&apos;s brackets</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Future Ideas</h2>
          <ul className="list-disc list-inside text-[rgb(var(--color-text-secondary))] space-y-1">
            <li>Auto import results from Matchplay tournaments (where available)</li>
            <li>Add additional states (likely prioritizing states with brackets on Matchplay)</li>
            <li>Improve bracket creation on mobile - wizard view instead of scrollable bracket</li>
            <li>Improve text that displays when links are shared - it&apos;s dull today, needs to be more personalized</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
