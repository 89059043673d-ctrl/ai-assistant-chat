'use client';

import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const components: Components = {
  // Инлайн/блочный код с корректной типизацией (inline присутствует в типе CodeComponent)
  code({ inline, children, ...props }) {
    return inline ? (
      <code className="px-1 py-0.5 rounded bg-zinc-200 text-zinc-900" {...props}>
        {children}
      </code>
    ) : (
      <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto" {...props}>
        <code>{children}</code>
      </pre>
    );
  },
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        className="underline text-zinc-900 hover:opacity-80"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },
  ul({ children, ...props }) {
    return (
      <ul className="list-disc pl-5 space-y-1" {...props}>
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol className="list-decimal pl-5 space-y-1" {...props}>
        {children}
      </ol>
    );
  },
};

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}
