// components/Markdown.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type Props = {
  children: string;
  className?: string;
};

export default function Markdown({ children, className = "" }: Props) {
  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        // Поддержка списков/таблиц/чекбоксов и математики
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        // Базовые маппинги, чтобы заголовки, жирный и т.д. смотрелись как надо
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mt-2 mb-3" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold mt-2 mb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold mt-2 mb-2" {...props} />
          ),
          p: ({ node, ...props }) => <p className="leading-relaxed" {...props} />,
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold" {...props} />
          ),
          code: ({ node, inline, className, children, ...props }) => {
            // однострочный код
            if (inline) {
              return (
                <code
                  className="rounded bg-zinc-800/70 px-1 py-0.5 text-[0.95em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            // Блочные — просто моноширинный блок
            return (
              <pre className="rounded bg-zinc-900/70 p-3 overflow-x-auto">
                <code>{children}</code>
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
