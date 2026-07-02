'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import { sendNLQuery } from '../../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTION_PROMPTS = [
  "Do we have any Paracetamol left?",
  "Which PHCs have surplus Amoxicillin?",
  "What medicines are expiring this month?",
  "Show me current stockout risks",
  "Which medicines are running critically low?",
  "Is there any transfer pending approval?",
];

export default function AIPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('phc_token');
    const s = localStorage.getItem('phc_user');
    if (!t) { router.push('/login'); return; }
    if (s) setUser(JSON.parse(s));
  }, []);

  useEffect(() => {
    if (user) {
      // Welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hello ${user.name}! 👋 I'm your PHC Exchange AI Assistant.\n\nI can help you:\n• Check stock levels at your PHC\n• Find nearby PHCs with surplus medicines\n• Identify expiry risks\n• Answer operational questions about the redistribution network\n\nWhat would you like to know?`,
        timestamp: new Date(),
      }]);
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendNLQuery(text.trim(), user?.phc_id);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data?.answer || 'I couldn\'t process that query. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ I\'m having trouble connecting to the data service right now. Please ensure the backend is running at http://localhost:8000.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex min-h-screen" style={{ background: '#030712' }}>
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col" style={{ height: '100vh' }}>
        {/* Header */}
        <div className="px-8 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,16,28,0.8)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AI Inventory Assistant</h1>
              <p className="text-xs text-gray-400">Grounded in live PHC network data · Local AI</p>
            </div>
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online · Live Data
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 mr-3 flex items-center justify-center mt-1"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                  </svg>
                </div>
              )}

              <div className="max-w-xl">
                <div
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line"
                  style={msg.role === 'user' ? {
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    borderBottomRightRadius: '4px',
                  } : {
                    background: 'rgba(17,24,39,0.9)',
                    color: '#e5e7eb',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderBottomLeftRadius: '4px',
                  }}>
                  {msg.content}
                </div>
                <div className="text-xs text-gray-600 mt-1 px-1" style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl flex-shrink-0 mr-3 flex items-center justify-center mt-1"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                </svg>
              </div>
              <div className="px-4 py-3.5 rounded-2xl" style={{ background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: '#10b981', animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion chips */}
        {messages.length <= 1 && (
          <div className="px-8 pb-2 flex flex-wrap gap-2">
            {SUGGESTION_PROMPTS.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#6ee7b7' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-8 py-5 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-end gap-3">
            <textarea
              id="ai-query-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask about stock levels, shortages, or redistribution options..."
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
              style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.07)', maxHeight: '120px' }}
            />
            <button
              id="send-query-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: loading || !input.trim() ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #10b981, #059669)',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
              }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">Press Enter to send · Shift+Enter for new line · Answers are grounded in live database context</p>
        </div>
      </main>
    </div>
  );
}
