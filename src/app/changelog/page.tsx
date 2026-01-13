import Link from "next/link";
import ResponsiveHeader from "@/components/ResponsiveHeader";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { getPageContent } from "@/lib/content";

export default async function ChangelogPage() {
  const content = await getPageContent("changelog");

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
        <h1 className="text-3xl font-bold mb-6">{content?.title || "Changelog"}</h1>

        {content ? (
          <MarkdownRenderer content={content.content} />
        ) : (
          <p className="text-[rgb(var(--color-text-secondary))]">
            Content not available.
          </p>
        )}
      </div>
    </main>
  );
}
