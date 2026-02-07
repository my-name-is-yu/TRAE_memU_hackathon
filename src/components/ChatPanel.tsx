"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/types/trip";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export default function ChatPanel({
  messages,
  onSend,
  isLoading,
  placeholder = "旅行の計画を教えてください...",
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-[20px] border-2 border-ink/20 shadow-step">
      <div className="px-4 py-3 border-b border-dashed border-ink/25 rounded-t-[20px]">
        <h3 className="font-bold text-ink text-sm tracking-wide">AIチャット</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted text-sm py-8">
            <p className="mb-2">旅行の計画をAIに相談しましょう</p>
            <p className="text-xs text-muted/50">
              例: 「3泊4日で京都旅行したい」
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-[12px] px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-mapblue text-white border border-mapblue"
                  : "bg-paper text-ink border border-ink/15"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-paper rounded-[12px] px-3 py-2 text-sm text-muted border border-ink/15">
              <span className="animate-pulse">考え中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-dashed border-ink/25">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 border-2 border-ink/30 rounded-[12px] bg-paper px-3 py-2 text-sm focus:outline-none focus:border-mapblue disabled:bg-muted/10 text-ink placeholder:text-muted/50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-ink text-surface px-4 py-2 rounded-full text-sm font-semibold tracking-wide hover:bg-ink/85 disabled:bg-muted/40 disabled:text-muted/60 disabled:cursor-not-allowed transition-colors shadow-step"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
