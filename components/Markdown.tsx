'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // Фикс типизации: используем any, чтобы взять inline без ошибок TS
        code: (props: any) => {
          const { inline, children, ...rest } = props || {};
          return inline ? (
            <code className="px-1 py-0.5 rounded bg-zinc-200 text-zinc-900" {...rest}>
              {children}
            </code>
          ) : (
            <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto" {...rest}>
              <code>{children}</code>
            </pre>
          );
        },
        a: ({ href, children, ...rest }) => (
          <a
            href={href}
            className="underline text-zinc-900 hover:opacity-80"
            target="_blank"
            rel="noreferrer"
            {...rest}
          >
            {children}
          </a>
        ),
        ul: ({ children, ...rest }) => (
          <ul className="list-disc pl-5 space-y-1" {...rest}>
            {children}
          </ul>
        ),
        ol: ({ children, ...rest }) => (
          <ol className="list-decimal pl-5 space-y-1" {...rest}>
            {children}
          </ol>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
