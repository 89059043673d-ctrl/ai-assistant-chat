'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type Props = { children: string; className?: string };

export default function Markdown({ children, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm as any, remarkMath as any, remarkBreaks as any]}
        rehypePlugins={[rehypeKatex as any]}
        components={{
          p: ({ node, ...props }) => (
            <p className="leading-7 whitespace-pre-wrap mb-3" {...props} />
          ),
          strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl md:text-3xl font-semibold mt-4 mb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl md:text-2xl font-semibold mt-4 mb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg md:text-xl font-semibold mt-3 mb-1" {...props} />
          ),
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 pl-3 italic opacity-80" {...props} />
          ),
          // единственное изменение — у параметров добавлен тип ": any"
          code({ inline, className, children, ...props }: any) {
            if (inline) {
              return (
                <code className="px-1 py-0.5 rounded bg-zinc-800/60" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="rounded-lg p-3 bg-zinc-900/70 overflow-x-auto">
                <code className={className}>{children}</code>
              </pre>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
