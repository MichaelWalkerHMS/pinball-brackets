import Link from "next/link";
import { getAllPageContent, getFAQItems } from "@/lib/content";

const PAGE_LABELS: Record<string, string> = {
  about: "About",
  privacy: "Privacy Policy",
  changelog: "Changelog",
};

export default async function AdminContentDashboard() {
  const [pages, faqItems] = await Promise.all([
    getAllPageContent(),
    getFAQItems(),
  ]);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
          Content Management
        </h1>
        <p className="text-[rgb(var(--color-text-secondary))] mt-1">
          Edit static pages and FAQ content
        </p>
      </div>

      {/* Markdown Pages Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))] mb-4">
          Pages
        </h2>
        <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] divide-y divide-[rgb(var(--color-border-primary))]">
          {pages.map((page) => (
            <Link
              key={page.id}
              href={`/admin/content/${page.page_slug}`}
              className="flex items-center justify-between p-4 hover:bg-[rgb(var(--color-bg-secondary))] transition-colors"
            >
              <div>
                <h3 className="font-medium text-[rgb(var(--color-text-primary))]">
                  {PAGE_LABELS[page.page_slug] || page.title}
                </h3>
                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                  Last updated:{" "}
                  {new Date(page.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="text-[rgb(var(--color-text-muted))]">&rarr;</span>
            </Link>
          ))}
          {pages.length === 0 && (
            <div className="p-4 text-center text-[rgb(var(--color-text-muted))]">
              No pages found. Run the database migration to seed content.
            </div>
          )}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))] mb-4">
          FAQ
        </h2>
        <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))]">
          <Link
            href="/admin/content/faq"
            className="flex items-center justify-between p-4 hover:bg-[rgb(var(--color-bg-secondary))] transition-colors"
          >
            <div>
              <h3 className="font-medium text-[rgb(var(--color-text-primary))]">
                Frequently Asked Questions
              </h3>
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                {faqItems.length} questions
              </p>
            </div>
            <span className="text-[rgb(var(--color-text-muted))]">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
