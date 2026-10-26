'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, UserCircle, Globe, Sparkles } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { useLanguage } from '@/components/layout/LanguageProvider';
import { useTranslation } from 'react-i18next';

const STARTER_QUESTIONS = [
  { key: 'starter1', icon: '🕳️' },
  { key: 'starter2', icon: '🗑️' },
  { key: 'starter3', icon: '💡' },
  { key: 'starter4', icon: '🚰' },
];

const REPORT_RE = /\[\[REPORT\s*(\{[\s\S]*?\})\s*\]\]/;

/** Split the assistant's text from the machine-readable report the prompt asks for. */
function splitReport(content: string): { text: string; href: string | null } {
  const m = REPORT_RE.exec(content);
  if (!m) return { text: content.replace(/\[\[REPORT[\s\S]*$/, '').trim(), href: null };
  try {
    const r = JSON.parse(m[1]) as { title?: string; category?: string; description?: string };
    const q = new URLSearchParams({ title: r.title ?? '', category: r.category ?? '', description: r.description ?? '' });
    return { text: content.replace(m[0], '').trim(), href: `/complaints/file?${q}` };
  } catch {
    return { text: content.replace(m[0], '').trim(), href: null };
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);

    // Add empty assistant message for streaming
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...updatedMessages, assistantMsg]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, language }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: errData.message || t('chat.errorGeneral'),
          };
          return copy;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    role: 'assistant',
                    content: copy[copy.length - 1].content + parsed.text,
                  };
                  return copy;
                });
              }
            } catch {
              // skip malformed data
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: t('chat.errorNetwork'),
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }, [messages, streaming, language]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">{t('chat.title')}</h1>
            <p className="text-[10px] text-gray-400">{t('chat.subtitle')}</p>
          </div>
        </div>

        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium
            text-gray-600 hover:bg-gray-50 transition-all"
        >
          <Globe className="w-3.5 h-3.5" />
          {language === 'en' ? 'EN → हि' : 'हि → EN'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 ? (
            /* Starter state */
            <div className="text-center pt-8 pb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {t('chat.greeting')}
              </h2>
              <p className="text-sm text-gray-500 mb-8">
                {t('chat.greetingSub')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q.key}
                    onClick={() => sendMessage(t(`chat.${q.key}`))}
                    className="text-left p-3 rounded-xl border border-gray-200 bg-white hover:border-indigo-300
                      hover:shadow-sm transition-all group"
                  >
                    <span className="text-lg mb-1 block">{q.icon}</span>
                    <span className="text-xs text-gray-600 group-hover:text-indigo-600 transition-colors">
                      {t(`chat.${q.key}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message bubbles */
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center
                    justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.content ? (() => {
                    const { text, href } = msg.role === 'assistant' ? splitReport(msg.content) : { text: msg.content, href: null };
                    return (
                      <>
                        <span className="whitespace-pre-line">{text}</span>
                        {href && (
                          <a href={href} className="mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-700 text-white font-medium hover:bg-indigo-800">
                            {t('chat.openReport')} →
                          </a>
                        )}
                      </>
                    );
                  })() : (
                    <span className="flex items-center gap-1 text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> {t('chat.thinking')}
                    </span>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <UserCircle className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            disabled={streaming}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none
              focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
