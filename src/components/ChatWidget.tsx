'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

type Message = { role: 'user' | 'bot'; text: string };

const SUGGESTIONS = [
  'Show orders for India',
  'Budget utilization',
  'Total ordered quantity',
  'Pending orders',
  'Price of Ultrasound X3',
  'Summary',
];

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/━+/g, '<span class="text-gray-300">$&</span>')
    .replace(/(🟢|🟡|🔴)/g, '<span class="text-lg">$1</span>')
    .replace(/\n/g, '<br/>');
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: '👋 Hi! I can answer questions about your procurement data. Try asking something or pick a suggestion below.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply || 'No response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, something went wrong.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-gray-600 hover:bg-gray-700 rotate-0' : 'bg-[#0B5ED7] hover:bg-[#0840A0] hover:scale-105'
        }`}
        title={open ? 'Close chat' : 'Open assistant'}
      >
        {open ? <X size={20} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: 'min(520px, calc(100vh - 160px))' }}>
          {/* Header */}
          <div className="bg-[#003399] px-4 py-3 flex items-center gap-2 shrink-0">
            <div className="p-1.5 bg-white/15 rounded-md">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">DEX Assistant</h3>
              <p className="text-[10px] text-blue-200">Ask about orders, budget, prices</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#0B5ED7] text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2 text-[13px] text-gray-500 flex items-center gap-1.5">
                  <span className="inline-flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Suggestions (only show at start) */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-2.5 py-1 text-[11px] bg-blue-50 text-[#0B5ED7] hover:bg-blue-100 rounded-full transition-colors font-medium"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 px-3 py-2.5 flex items-center gap-2 shrink-0 bg-white">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about your data..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none"
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="p-2 bg-[#0B5ED7] hover:bg-[#0840A0] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
