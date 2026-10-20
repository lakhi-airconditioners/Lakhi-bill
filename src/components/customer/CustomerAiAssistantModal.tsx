import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  ShoppingBag,
  Truck,
  Receipt,
  FileCheck2,
  Clock,
  Phone,
  HelpCircle,
  Loader2,
  Check,
  MapPin,
  AlertCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, Invoice, Shipment, Quotation } from '../../types';

interface CustomerAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  invoices: Invoice[];
  shipments: Shipment[];
  quotations: Quotation[];
  onNavigateTab: (tab: 'TRACKING' | 'INVOICES' | 'WARRANTY' | 'LEDGER' | 'QUOTES') => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  action?: {
    type: 'UPDATE_PROFILE' | 'NONE';
    payload?: any;
    status?: 'PENDING' | 'DONE' | 'CANCELLED';
    resultId?: string;
  };
}

export const CustomerAiAssistantModal: React.FC<CustomerAiAssistantModalProps> = ({
  isOpen,
  onClose,
  customer,
  invoices,
  shipments,
  quotations,
  onNavigateTab,
}) => {
  const { updateCustomer } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello ${customer.externalName || 'there'}! I am your Lakhi Customer Assistant. You can ask me anything about your AC delivery status, invoice copies, pending balance, warranty serial numbers, or ask me to update your delivery address, phone number, or profile details. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/[*#_`~>•]/g, '')
        .replace(/\b([A-Z0-9]+-[A-Z0-9]+)\b/g, '$1')
        .slice(0, 300);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'en-IN';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInputMessage(transcript);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleSpeech = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const custInvoices = invoices.filter((i) => i.customerId === customer.id);
      const custShipments = shipments.filter(
        (s) => s.customerId === customer.id || (s.customerPhone && s.customerPhone.includes(customer.phone.slice(-8)))
      );
      const custQuotes = quotations.filter((q) => q.customerId === customer.id);

      const res = await fetch('/api/ai/customer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          customer,
          invoices: custInvoices,
          shipments: custShipments,
          quotations: custQuotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.reply || 'I am here to assist with your order details.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action:
            data.action && data.action.type === 'UPDATE_PROFILE'
              ? { ...data.action, status: 'PENDING' }
              : undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);
        speakText(aiMsg.text);
      } else {
        throw new Error('Server request failed');
      }
    } catch {
      // Local fallback
      let reply = `Thank you for your question. You can track your shipments in the "Deliveries" tab or view tax invoices in the "Invoices" tab. For direct staff assistance, please call +91 99980 21446.`;
      let fallbackAction: any = undefined;
      const lower = text.toLowerCase();
      if (lower.includes('order') || lower.includes('delivery') || lower.includes('where')) {
        const custShipments = shipments.filter((s) => s.customerId === customer.id);
        if (custShipments.length > 0) {
          const s = custShipments[0];
          reply = `Your shipment #${s.id} is currently in stage: "${s.status}". Delivery address: ${s.deliveryAddress}.${s.driverName ? ` Driver: ${s.driverName} (${s.driverPhone || ''})` : ''}`;
        } else {
          reply = `You do not have any active shipments right now. If you placed an order recently, please contact Lakhi store at +91 99980 21446.`;
        }
      } else if (lower.includes('balance') || lower.includes('due') || lower.includes('bill')) {
        const custInvoices = invoices.filter((i) => i.customerId === customer.id);
        const totalDue = custInvoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
        reply = `Your total pending balance across ${custInvoices.length} invoice(s) is ₹${totalDue.toLocaleString('en-IN')}.`;
      } else if (lower.includes('serial') || lower.includes('warranty') || lower.includes('unit') || lower.includes('idu') || lower.includes('odu')) {
        const custInvoices = invoices.filter((i) => i.customerId === customer.id);
        const allItems = custInvoices.flatMap((inv) => inv.items || []);
        if (allItems.length > 0) {
          const itemLines = allItems.map((it) => {
            const isAc = (it.type || '').toUpperCase() === 'AC';
            if (isAc) {
              return `• ${it.name} (${it.brand || 'Daikin'}): IDU Model: ${it.indoorModelNo || it.modelNo || '-'}, Indoor S/N: ${it.indoorUnitSerial || it.serialNo || '-'} | ODU Model: ${it.outdoorModelNo || '-'}, Outdoor S/N: ${it.outdoorUnitSerial || '-'}`;
            }
            return `• ${it.name} (${it.modelNo}): Serial No: ${it.serialNo || '-'}`;
          }).join('\n');
          reply = `Here are your registered appliances and warranty serial numbers:\n\n${itemLines}`;
        } else {
          reply = `No appliances are registered under your account yet. If you recently purchased equipment, please contact Lakhi store at +91 99980 21446.`;
        }
      } else if (lower.includes('address') || lower.includes('phone') || lower.includes('name')) {
        reply = `I can update your contact and delivery records in our database. Please confirm the details below:`;
        fallbackAction = {
          type: 'UPDATE_PROFILE',
          status: 'PENDING',
          payload: {
            summary: `Update requested via customer chat: "${text}"`,
          },
        };
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: fallbackAction,
        },
      ]);
      speakText(reply);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmUpdateProfile = async (msgId: string, payload: any) => {
    try {
      const updates: Partial<Customer> = {
        ...(payload.externalName ? { externalName: payload.externalName } : {}),
        ...(payload.phone ? { phone: payload.phone } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.billingAddress ? { billingAddress: payload.billingAddress } : {}),
        ...(payload.installationAddress ? { installationAddress: payload.installationAddress } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      };

      await updateCustomer(customer.id, updates);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: payload.summary || 'Customer details updated in Lakhi Firebase database!',
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error updating customer profile in Firebase:', err);
      alert('Failed to update details: ' + (err.message || 'Unknown error'));
    }
  };

  if (!isOpen) return null;

  const quickPrompts = [
    { label: '🚚 Where is my order right now?', prompt: 'Where is my order right now?' },
    { label: '📍 Update my delivery address', prompt: 'I want to update my delivery and installation address' },
    { label: '📱 Update my contact phone', prompt: 'I want to change my registered phone number' },
    { label: '💰 What is my pending balance & bill amount?', prompt: 'What is my pending balance and total bill amount?' },
    { label: '🛡️ What AC models and serial numbers did I buy?', prompt: 'List all the AC models and serial numbers I bought.' },
    { label: '⏰ Store hours and phone number', prompt: 'What are your store hours and contact number?' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-linear-to-r from-red-600 via-rose-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 text-white shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base tracking-wide">Lakhi Customer AI Copilot</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/25">Live</span>
              </div>
              <p className="text-[11px] text-white/80">
                Personalized support for {customer.externalName} • ID: {customer.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isTtsEnabled) {
                  stopSpeaking();
                  setIsTtsEnabled(false);
                } else {
                  setIsTtsEnabled(true);
                  speakText('Voice assistance enabled.');
                }
              }}
              className={`p-1.5 rounded-xl transition-colors ${
                isTtsEnabled ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/20'
              }`}
              title={isTtsEnabled ? 'Turn off Voice Readout' : 'Turn on Voice Readout'}
            >
              {isTtsEnabled ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat History */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.sender === 'user'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-700 shadow-xs'
                }`}
              >
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[82%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-red-600 text-white shadow-xs rounded-tr-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-xs rounded-tl-xs whitespace-pre-line'
                }`}
              >
                <p>{m.text}</p>

                {/* Profile Update Action Card */}
                {m.action && m.action.type === 'UPDATE_PROFILE' && (
                  <div className="mt-2.5 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200/50 dark:border-indigo-900/40">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300 text-[11px]">
                        <User className="w-3.5 h-3.5" />
                        <span>Update Customer Profile in Firebase</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                        {m.action.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-700 dark:text-slate-200">
                      {m.action.payload?.externalName && (
                        <div>Name: <strong>{m.action.payload.externalName}</strong></div>
                      )}
                      {m.action.payload?.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>Phone: <strong>{m.action.payload.phone}</strong></span>
                        </div>
                      )}
                      {m.action.payload?.email && (
                        <div>Email: <strong>{m.action.payload.email}</strong></div>
                      )}
                      {m.action.payload?.installationAddress && (
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                          <span>Installation Address: <strong>{m.action.payload.installationAddress}</strong></span>
                        </div>
                      )}
                      {m.action.payload?.billingAddress && (
                        <div>Billing Address: <span>{m.action.payload.billingAddress}</span></div>
                      )}
                      {m.action.payload?.summary && (
                        <div className="italic text-slate-500 text-[10px] pt-1">
                          {m.action.payload.summary}
                        </div>
                      )}
                    </div>

                    {m.action.status === 'PENDING' ? (
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmUpdateProfile(m.id, m.action?.payload)}
                          className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 text-[11px] shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm & Save to Firebase</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((msg) =>
                                msg.id === m.id
                                  ? { ...msg, action: { ...msg.action!, status: 'CANCELLED' } }
                                  : msg
                              )
                            )
                          }
                          className="py-1.5 px-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : m.action.status === 'DONE' ? (
                      <div className="mt-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{m.action.resultId || 'Profile updated in Firebase!'}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">Update cancelled.</div>
                    )}
                  </div>
                )}

                <span
                  className={`block text-[9px] mt-1 text-right ${
                    m.sender === 'user' ? 'text-white/70' : 'text-slate-400'
                  }`}
                >
                  {m.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
              <span>Lakhi AI is checking your account and order records...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex gap-2 overflow-x-auto scrollbar-none bg-white dark:bg-slate-900 shrink-0">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0 border border-slate-200 dark:border-slate-700"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0"
        >
          {speechSupported && (
            <button
              type="button"
              onClick={toggleSpeech}
              className={`p-2.5 rounded-xl transition-all ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
              title={isListening ? 'Stop listening' : 'Speak to AI'}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          )}

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask anything about your order, bill, warranty, or delivery..."
            className="flex-1 px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="p-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-xs"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
