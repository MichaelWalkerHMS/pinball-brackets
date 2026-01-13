import { notFound } from "next/navigation";
import { getPageContent } from "@/lib/content";
import ContentEditor from "./ContentEditor";

const VALID_SLUGS = ["about", "privacy", "changelog"];

const PAGE_LABELS: Record<string, string> = {
  about: "About",
  privacy: "Privacy Policy",
  changelog: "Changelog",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditContentPage({ params }: PageProps) {
  const { slug } = await params;

  // Validate slug
  if (!VALID_SLUGS.includes(slug)) {
    notFound();
  }

  const content = await getPageContent(slug);

  if (!content) {
    notFound();
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
          Edit {PAGE_LABELS[slug] || slug}
        </h1>
        <p className="text-[rgb(var(--color-text-secondary))] mt-1">
          Update the content for the {PAGE_LABELS[slug]?.toLowerCase() || slug} page
        </p>
      </div>

      <ContentEditor
        slug={slug}
        initialTitle={content.title}
        initialContent={content.content}
        updatedAt={content.updated_at}
      />
    </div>
  );
}
