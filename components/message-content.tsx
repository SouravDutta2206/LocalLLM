"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Copy, Check } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypePrismPlus from "rehype-prism-plus"
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import "prismjs/themes/prism-tomorrow.css"
import "@/app/globals.css"

interface MessageContentProps {
  content: string
  isUser: boolean
}

export function MessageContent({ content, isUser }: MessageContentProps) {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>
  }

  // Preprocess content to handle math properly while preserving other formatting
  const preprocessContent = (text: string) => {
    // 1. Protect code blocks
    const codeBlocks: string[] = [];
    let processedText = text.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
      codeBlocks.push(match);
      return `___CODE${codeBlocks.length - 1}___`;
    });

    // 2. Handle display math ($$...$$)
    const displayMath: string[] = [];
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      displayMath.push(`$$${formula.trim()}$$`);
      return `___DISPLAY_MATH${displayMath.length - 1}___`;
    });

    // 3. Handle inline math ($...$ and \(...\)
    const inlineMath: string[] = [];
    processedText = processedText.replace(/\$([^$\n]+?)\$|\(\(([^$\n]+?)\)\)/g, (match, formula1, formula2) => {
      const formula = formula1 || formula2;
      const delimiter = match.startsWith('$') ? '$' : '\\'; // Determine original delimiter
      // Reconstruct with original delimiter type
      inlineMath.push(delimiter === '$' ? `$${formula.trim()}$` : `\\(${formula.trim()}\\)`);
      return `___INLINE_MATH${inlineMath.length - 1}___`;
    });

    // 4. Restore display math with proper spacing
    processedText = processedText.replace(/___DISPLAY_MATH(\d+)___/g, (_, index) => {
      return `\n\n${displayMath[parseInt(index)]}\n\n`;
    });

    // 5. Restore inline math
    processedText = processedText.replace(/___INLINE_MATH(\d+)___/g, (_, index) => {
      return inlineMath[parseInt(index)];
    });

    // 6. Restore code blocks
    processedText = processedText.replace(/___CODE(\d+)___/g, (_, index) => {
      return codeBlocks[parseInt(index)];
    });

    return processedText.trim();
  };

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypePrismPlus, { ignoreMissing: true, showLineNumbers: true }],
          [rehypeKatex, {
            strict: true,
            throwOnError: false,
            trust: true,
            macros: {
              "\\eqref": "\\href{#1}{}",   // Handle equation references
            }
          }]
        ]}
        components={{
          pre: ({ node, ...props }) => {
            const [copied, setCopied] = useState(false)
            const preRef = useRef<HTMLPreElement>(null)
            const [language, setLanguage] = useState("")
            
            useEffect(() => {
              if (preRef.current) {
                const codeElement = preRef.current.querySelector('code')
                const lang = codeElement?.className?.match(/language-(\w+)/)?.[1]
                if (lang) {
                  setLanguage(lang)
                }
              }
            }, [])
            
            const handleCopy = async () => {
              if (preRef.current) {
                const code = preRef.current.textContent
                await navigator.clipboard.writeText(code || '')
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }
            }
            
            return (
              <div className="relative group rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
                  <div className="text-sm text-zinc-400">
                    {language}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre ref={preRef} {...props} className="!mt-0 !rounded-t-none bg-zinc-950 p-4 overflow-x-auto" />
              </div>
            )
          },
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match
            if (isInline) {
              return (
                <code {...props} className="bg-zinc-800 rounded px-1.5 py-0.5">
                  {children}
                </code>
              )
            }
            return (
              <code {...props} className={cn(className, "bg-transparent")}>
                {children}
              </code>
            )
          }
        }}
      >
        {preprocessContent(content)}
      </ReactMarkdown>
    </div>
  )
} 