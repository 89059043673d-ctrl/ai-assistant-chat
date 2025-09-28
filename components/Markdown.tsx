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
        /* жирный/курсив/заголовки остаются по умолчанию */
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
        /* списки чуть компактнее */
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
