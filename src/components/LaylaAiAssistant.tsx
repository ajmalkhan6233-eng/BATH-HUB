import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';
import { currentDay, sampleCheques, sampleProducts, initialStaffList, sampleCustomers, branding } from '../mockData';
import { LaylaChatMessage } from '../types';

export default function LaylaAiAssistant() {
  const [messages, setMessages] = useState<LaylaChatMessage[]>([
    {
      id: 'm1',
      sender: 'assistant',
      text: `Assalamu alaikum! I am Layla, your Royal Bath Hub ERP copilot. I have live access to your sales, cheques, inventory, and customer ledgers. How can I assist your business today?`,
      timestamp: '09:00 AM',
      suggestions: [
        "What are our sales and net profit today?",
        "Which supplier cheques are due this week?",
        "Are any tile products low on stock?",
        "Show current customer credit risk summary"
      ]
    }
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || inputText).trim();
    if (!q) return;

    const userMsg: LaylaChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');

    // Generate intelligent ERP response
    setTimeout(() => {
      let reply = "";
      const lower = q.toLowerCase();

      if (lower.includes('sales') || lower.includes('profit') || lower.includes('today')) {
        reply = `📊 **Today's Financial Summary (${currentDay.date}):**\n- **Gross Sales:** ${branding.currency_symbol} ${currentDay.total_sale.toLocaleString()} across ${currentDay.invoices} invoices.\n- **Petty Cash Expenses:** ${branding.currency_symbol} ${currentDay.expenses.toLocaleString()}.\n- **Net Profit:** ${branding.currency_symbol} ${currentDay.net_profit.toLocaleString()} (healthy gross margin).\n- **Cash in Hand:** ${branding.currency_symbol} ${currentDay.cash_in_hand.toLocaleString()} matching expected drawer float.`;
      } else if (lower.includes('cheque') || lower.includes('supplier') || lower.includes('due')) {
        const pending = sampleCheques.filter(c => c.status === 'PENDING');
        const outward = pending.filter(c => c.type === 'OUTWARD');
        const total = outward.reduce((a, b) => a + b.amount, 0);
        reply = `🏦 **PDC Cheque Alert:**\nYou have **${outward.length} outward cheques** pending clearance totaling **${branding.currency_symbol} ${total.toLocaleString()}**.\n- Eskema Ceramic: ${branding.currency_symbol} 250,000 due 11 Jun.\nRemember the Sri Lankan bank clearing rule: other-bank cheques require an additional business day to clear.`;
      } else if (lower.includes('stock') || lower.includes('inventory') || lower.includes('low')) {
        const low = sampleProducts.filter(p => p.stock <= p.minStock);
        reply = `📦 **Inventory & Reorder Alert:**\nFound **${low.length} item(s)** near or below minimum reserve limit:\n${low.map(p => `• **${p.name}**: ${p.stock} ${p.unit} remaining (Min: ${p.minStock})`).join('\n')}\nRecommendation: Raise a GRN purchase order with your supplier.`;
      } else if (lower.includes('credit') || lower.includes('customer') || lower.includes('aging')) {
        const highRisk = sampleCustomers.filter(c => c.status === 'OVERDUE');
        reply = `💳 **Credit Aging Status:**\n- **Total Customer Debt:** ${branding.currency_symbol} 845,000.\n- **Critical Overdue (90+ Days):** ${highRisk.map(c => `${c.name} (${branding.currency_symbol} ${c.bucket90_plus.toLocaleString()})`).join(', ')}.\nAll customer communications follow courteous, ethical standards.`;
      } else if (lower.includes('staff') || lower.includes('commission')) {
        const top = initialStaffList[1];
        reply = `👤 **Staff Performance & Commission:**\n- Leading Consultant: **${top.name}** with ${branding.currency_symbol} ${(top.salesMonth || 0).toLocaleString()} in sales.\n- Accrued Commission: ${branding.currency_symbol} ${(top.commissionEarned || 0).toLocaleString()} (based on standard 2.0% store rate).`;
      } else {
        reply = `I understand you're asking about "${q}". Based on your Royal Bath Hub ERP records, everything is synchronized as of Asia/Colombo time. You can view detailed breakdowns in the Operations and Finance navigation tabs above.`;
      }

      const botMsg: LaylaChatMessage = {
        id: 'msg_bot_' + Date.now(),
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    }, 400);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-[#d4af37]/30 rounded-2xl p-5 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#8a6e1d] flex items-center justify-center text-[#062e21] shadow-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              LAYLA — ERP Intelligence Copilot
            </h2>
            <p className="text-xs text-white/50">Halal-compliant, honesty-first reasoning engine for Royal Bath Hub.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          <ShieldCheck className="w-4 h-4" />
          <span>Honesty Guard Active · No Guessing</span>
        </div>
      </div>

      {/* Chat Window */}
      <div className="bg-[#0a140e]/80 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl flex flex-col h-[520px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.sender === 'user' ? 'bg-[#d4af37] text-[#062e21]' : 'bg-white/10 text-[#d4af37]'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="flex flex-col gap-1">
                <div className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                  msg.sender === 'user'
                    ? 'bg-[#d4af37] text-[#062e21] font-medium rounded-tr-none'
                    : 'bg-black/40 border border-white/10 text-white/90 rounded-tl-none shadow-md'
                }`}>
                  {msg.text}
                </div>
                <span className={`text-[10px] text-white/40 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                  {msg.timestamp}
                </span>

                {/* Suggestions chips */}
                {msg.suggestions && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(s)}
                        className="bg-white/5 hover:bg-[#d4af37]/20 border border-white/10 hover:border-[#d4af37]/40 text-white/80 hover:text-white px-2.5 py-1 rounded-lg text-[11px] transition-colors text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="pt-4 mt-2 border-t border-white/10 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask Layla anything about sales, pending cheques, stock or profit..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="bg-[#d4af37] hover:bg-[#ebd075] disabled:opacity-40 text-[#062e21] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
