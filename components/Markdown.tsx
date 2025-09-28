'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        code: ({ inline, children }) =>
          inline ? (
            <code className="px-1 py-0.5 rounded bg-zinc-200 text-zinc-900">{children}</code>
          ) : (
            <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">
              <code>{children}</code>
            </pre>
          ),
        a: ({ href, children }) => (
          <a href={href} className="underline text-zinc-900 hover:opacity-80" target="_blank">
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
