// components/Markdown.tsx
"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

type Props = { children: string };

const components: Components = {
  h1: ({ node, ...props }) => (
    <h1 className="text-2xl font-semibold my-3" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="text-xl font-semibold my-3" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-lg font-semibold my-2" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="leading-7 my-2 whitespace-pre-wrap" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="list-disc ml-6 my-2 space-y-1" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal ml-6 my-2 space-y-1" {...props} />
  ),
  li: ({ node, ...props }) => <li className="leading-7" {...props} />,

  // --- ТАБЛИЦЫ (GFM) ---
  table: ({ node, ...props }) => (
    <table className="w-full border-collapse my-4 text-sm" {...props} />
  ),
  thead: ({ node, ...props }) => <thead className="bg-muted/40" {...props} />,
  tbody: ({ node, ...props }) => <tbody {...props} />,
  tr: ({ node, ...props }) => (
    <tr className="border-b border-border/50" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th
      className="text-left font-medium px-3 py-2 border border-border/50 align-middle"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td className="px-3 py-2 border border-border/50 align-top" {...props} />
  ),

  // --- КОД ---
  code({ inline, className, children, ...props }) {
    const txt = String(children);
    if (inline) {
      return (
        <code className="px-1 py-0.5 rounded bg-muted/50" {...props}>
          {txt}
        </code>
      );
    }
    return (
      <pre className="my-3 rounded bg-muted/50 p-3 overflow-x-auto">
        <code className={className} {...props}>
          {txt}
        </code>
      </pre>
    );
  },
};

export default function Markdown({ children }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}
