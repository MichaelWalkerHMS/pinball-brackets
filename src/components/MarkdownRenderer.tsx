import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with consistent styling matching the site theme.
 * Supports headers, paragraphs, lists, links, bold, italic, and code blocks.
 */
export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
        // Headers
        h1: ({ children }) => (
          <h1 className="text-3xl font-bold mb-6">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold mb-3 mt-8 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold mb-2 mt-6">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="text-[rgb(var(--color-text-secondary))] mb-4">{children}</p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-[rgb(var(--color-text-secondary))] space-y-1 mb-4">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside ml-6 text-[rgb(var(--color-text-secondary))] space-y-2 mb-4">
            {children}
          </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-[rgb(var(--color-accent-primary))] hover:underline"
            target={href?.startsWith("http") ? "_blank" : undefined}
            rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {children}
          </a>
        ),
        // Strong/Bold
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        // Emphasis/Italic
        em: ({ children }) => <em className="italic">{children}</em>,
        // Code blocks
        code: ({ className, children }) => {
          // Check if this is an inline code or a block
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block bg-[rgb(var(--color-bg-secondary))] p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4">
                {children}
              </code>
            );
          }
          return (
            <code className="bg-[rgb(var(--color-bg-secondary))] px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-4">{children}</pre>,
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[rgb(var(--color-border-primary))] pl-4 italic text-[rgb(var(--color-text-secondary))] mb-4">
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => <hr className="border-[rgb(var(--color-border-primary))] my-8" />,
      }}
    >
      {content}
      </ReactMarkdown>
    </div>
  );
}
