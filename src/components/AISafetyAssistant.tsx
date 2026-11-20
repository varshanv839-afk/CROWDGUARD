import React, { useState } from 'react';
import { Bot, Send, X, Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface AISafetyAssistantProps {
  open: boolean;
  onClose: () => void;
  telemetryContext: Record<string, unknown>;
}

const QUICK_PROMPTS = [
  'Which zone currently has the highest risk and why?',
  'Explain why the latest crowd alert was generated.',
  'What preventive actions and evacuation exits should we prioritize now?',
];

export const AISafetyAssistant: React.FC<AISafetyAssistantProps> = ({
  open,
  onClose,
  telemetryContext,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'CROWGUARD AI Safety Assistant ready. Ask about highest-risk zones, Optical Flow anomalies, alert causes, or evacuation routing based on current dashboard telemetry.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          context: telemetryContext,
          history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Safety Assistant request failed.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.answer,
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach AI Safety Assistant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[410px] bg-[#0A101D] border-l border-slate-800 shadow-2xl flex flex-col">
      <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">AI Safety Assistant</h2>
            <p className="text-[11px] text-slate-400">Grounded in live CROWGUARD telemetry</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close AI Safety Assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-[#070B14] space-y-2 shrink-0">
        <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Quick Operator Queries
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => sendQuestion(q)}
              className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-[#0D1424] hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0D1424] border border-slate-800 text-slate-200'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>Analyzing live zone &amp; alert telemetry...</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
        className="p-4 border-t border-slate-800/80 bg-[#0A101D] flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about crowd risks, alerts, or exits..."
          className="flex-1 bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
          aria-label="Send question"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
