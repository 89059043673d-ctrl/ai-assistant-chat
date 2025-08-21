"use client";

import remarkBreaks from "remark-breaks";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

// стили KaTeX должны быть подключены однажды в глобалах:
// import "katex/dist/katex.min.css";

type Props = {
  children: string;
  className?: string;
};

export default function Markdown({ children, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
  rehypePlugins={[rehypeKatex]}
  /* остальное без изменений */
>
        // HTML не рендерим для безопасности
        skipHtml
        // кастомизация некоторых элементов
        components={{
          // однострочный код
          code: (props: any) => {
            const { inline, className, children, ...rest } = props;
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
          strong: ({ children, ...rest }) => (
            <strong className="font-bold" {...rest}>
              {children}
            </strong>
          ),
          hr: () => <hr className="my-4 border-white/10" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
