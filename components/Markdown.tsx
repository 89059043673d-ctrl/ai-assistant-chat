"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import type { PluggableList } from "unified";

type Props = {
  children: string;
  className?: string;
};

// Мягко приводим плагины к ожидаемому типу, чтобы не падало на тайпингах
const rPlugins: PluggableList = [
  remarkGfm as any,
  remarkMath as any,
  remarkBreaks as any,
];

const hPlugins: PluggableList = [rehypeKatex as any];

export default function Markdown({ children, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={rPlugins}
        rehypePlugins={hPlugins}
        // Не даём рендерить сырой HTML из модели
        skipHtml
        components={{
          // однострочный `код`
          code: (props: any) => {
            const { inline, children, ...rest } = props;
            if (inline) {
              return (
                <code
                  className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            // блок кода
            return (
              <pre className="overflow-x-auto rounded-lg bg-black/20 p-3 text-[0.95em]">
                <code>{children}</code>
              </pre>
            );
          },
          // **жирный**
          strong: ({ children, ...rest }) => (
            <strong className="font-bold" {...rest}>
              {children}
            </strong>
          ),
          // горизонтальная линия
          hr: () => <hr className="my-4 border-white/10" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
