import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-bg-card border border-border rounded-2xl px-4 py-3">
          <p className="text-[15px] leading-relaxed text-text-primary whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-accent-blue flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-1">
        AI
      </div>
      <div className="flex-1 min-w-0 prose-container">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Override default elements for our dark theme
            p: ({ children }) => (
              <p className="text-[15px] leading-relaxed text-text-primary mb-3 last:mb-0">
                {children}
              </p>
            ),
            h1: ({ children }) => (
              <h1 className="text-xl font-semibold text-text-primary mt-4 mb-2">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-text-primary mt-3 mb-2">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold text-text-primary mt-3 mb-1">{children}</h3>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside text-text-primary text-[15px] leading-relaxed mb-3 space-y-1">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside text-text-primary text-[15px] leading-relaxed mb-3 space-y-1">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="text-text-primary">{children}</li>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue hover:underline"
              >
                {children}
              </a>
            ),
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="bg-bg-card border border-border rounded px-1.5 py-0.5 text-sm font-mono text-amber-300">
                    {children}
                  </code>
                );
              }
              return (
                <div className="my-3 rounded-lg overflow-hidden border border-border">
                  {className && (
                    <div className="bg-bg-sidebar px-3 py-1.5 text-xs text-text-tertiary border-b border-border font-mono">
                      {className.replace('language-', '')}
                    </div>
                  )}
                  <pre className="bg-bg-main p-3 overflow-x-auto">
                    <code className="text-sm font-mono text-text-primary leading-relaxed" {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            },
            pre: ({ children }) => <>{children}</>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-accent-blue/50 pl-3 my-3 text-text-secondary italic">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="bg-bg-sidebar px-3 py-2 text-left text-text-secondary font-medium border-b border-border">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 text-text-primary border-b border-border/50">
                {children}
              </td>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-text-primary">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
            hr: () => <hr className="my-4 border-border" />,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
