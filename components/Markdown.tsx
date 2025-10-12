import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownProps = {
  /** Можно передавать либо children, либо content — берём то, что есть */
  children?: string;
  content?: string;
  className?: string;
};

/**
 * Рендер Markdown c поддержкой GFM-таблиц.
 * Широкие таблицы получают горизонтальный скролл, чтобы не «пробивать» фон
 * и не выходить за пределы пузыря сообщения.
 */
export default function Markdown({ children, content, className }: MarkdownProps) {
  const source = children ?? content ?? "";

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // --- ТАБЛИЦЫ (GFM) ---
          // Оборачиваем <table> в прокручиваемый контейнер.
          table: ({ node, ...props }) => (
            <div className="my-4 -mx-2 sm:-mx-4 overflow-x-auto">
              <table
                className="min-w-[720px] w-full border-collapse text-sm"
                {...props}
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-50 dark:bg-gray-800/50" {...props} />
          ),
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => (
            <tr
              className="border-b border-gray-200 dark:border-gray-700"
              {...props}
            />
          ),
          th: ({ node, ...props }) => (
            <th
              className="text-left font-medium px-3 py-2 border border-gray-200 dark:border-gray-700 align-middle"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 align-top"
              {...props}
            />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
