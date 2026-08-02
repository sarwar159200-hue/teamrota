"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, HelpCircle, Loader2, MessageCircle, Send, Sparkles, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";

const HR_CONTACT_EMAIL = "reza.kamil@taurusenergy.com";

type Message = { role: "user" | "assistant"; content: string };
type Language = "en" | "ku" | "ar" | "ur";

const copy = {
  en: {
    title: "Ask TeamRota", subtitle: "Rota, leave, overtime and timesheet help", greeting: "Hello! I can help with your own TeamRota information and approved HR guidance.",
    placeholder: "Ask a question…", send: "Send", fallback: "For formal decisions, please confirm with HR or Admin.", error: "I could not connect right now. Please contact HR or Admin.",
    quick: ["What is my leave balance?", "Who is my line manager?", "How do I submit leave?", "Where is my timesheet?"], contact: "Contact HR", disclaimer: "AI answers may be incomplete. HR remains the official source for employment decisions."
  },
  ku: {
    title: "پرسیار لە TeamRota", subtitle: "یارمەتی ڕۆتا، مۆڵەت، کاتی زیادە و خشتەی کات", greeting: "سڵاو! دەتوانم لە زانیارییەکانی خۆت و ڕێنماییە پەسەندکراوەکانی HR یارمەتیت بدەم.",
    placeholder: "پرسیارێک بنووسە…", send: "ناردن", fallback: "بۆ بڕیاری فەرمی تکایە لەگەڵ HR یان ئەدمین دڵنیابە.", error: "ئێستا ناتوانم پەیوەندی بکەم. تکایە پەیوەندی بە HR یان ئەدمین بکە.",
    quick: ["باڵانسی مۆڵەتم چەندە؟", "بەڕێوەبەری من کێیە؟", "چۆن داواکاری مۆڵەت بکەم؟", "خشتەی کاتم لە کوێیە؟"], contact: "پەیوەندی بە HR", disclaimer: "وەڵامی AI لەوانەیە تەواو نەبێت. HR سەرچاوەی فەرمی بڕیارەکانی کارە."
  },
  ar: {
    title: "اسأل TeamRota", subtitle: "مساعدة المناوبات والإجازات والإضافي وسجل الدوام", greeting: "مرحباً! يمكنني مساعدتك في معلومات TeamRota الخاصة بك وإرشادات الموارد البشرية المعتمدة.",
    placeholder: "اكتب سؤالك…", send: "إرسال", fallback: "للقرارات الرسمية يرجى التأكيد مع الموارد البشرية أو المسؤول.", error: "تعذر الاتصال الآن. يرجى التواصل مع الموارد البشرية أو المسؤول.",
    quick: ["ما رصيد إجازاتي؟", "من هو مديري المباشر؟", "كيف أقدم طلب إجازة؟", "أين سجل دوامي؟"], contact: "تواصل مع الموارد البشرية", disclaimer: "قد تكون إجابات الذكاء الاصطناعي غير مكتملة. الموارد البشرية هي المرجع الرسمي لقرارات العمل."
  },
  ur: {
    title: "TeamRota سے پوچھیں", subtitle: "روٹا، چھٹی، اوور ٹائم اور ٹائم شیٹ مدد", greeting: "خوش آمدید! میں آپ کی مجاز TeamRota معلومات اور منظور شدہ HR رہنمائی میں مدد کر سکتا ہوں۔",
    placeholder: "اپنا سوال لکھیں…", send: "بھیجیں", fallback: "رسمی فیصلوں کے لیے HR یا ایڈمن سے تصدیق کریں۔", error: "اس وقت رابطہ نہیں ہو سکا۔ براہ کرم HR یا ایڈمن سے رابطہ کریں۔",
    quick: ["میری چھٹی کا بیلنس کیا ہے؟", "میرا لائن منیجر کون ہے؟", "چھٹی کی درخواست کیسے دوں؟", "میری ٹائم شیٹ کہاں ہے؟"], contact: "HR سے رابطہ کریں", disclaimer: "AI کے جوابات نامکمل ہو سکتے ہیں۔ ملازمت کے رسمی فیصلوں کے لیے HR حتمی ذریعہ ہے۔"
  }
};

function detectLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("teamrota-language");
  return saved === "ku" || saved === "ar" || saved === "ur" ? saved : "en";
}

export default function TeamRotaAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lang = detectLanguage();
    setLanguage(lang);
    setMessages([{ role: "assistant", content: copy[lang].greeting }]);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  if (["/login", "/reset-password", "/forgot-password"].some((p) => pathname?.startsWith(p))) return null;
  const c = copy[language];

  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, language, history: messages.slice(-8) }),
      });
      const data = await response.json();
      setMessages([...next, { role: "assistant", content: response.ok ? data.answer : (data.error || c.error) }]);
    } catch {
      setMessages([...next, { role: "assistant", content: c.error }]);
    } finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }

  return (
    <div className={`teamrota-ai ${open ? "open" : ""}`} data-no-translate>
      {open && (
        <section className="teamrota-ai-panel" role="dialog" aria-label={c.title}>
          <header className="teamrota-ai-header">
            <div className="teamrota-ai-logo"><Sparkles size={19}/></div>
            <div><strong>{c.title}</strong><span>{c.subtitle}</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={19}/></button>
          </header>
          <div className="teamrota-ai-messages">
            {messages.map((message, index) => (
              <div className={`teamrota-ai-message ${message.role}`} key={`${message.role}-${index}`}>
                <span className="teamrota-ai-avatar">{message.role === "assistant" ? <Bot size={16}/> : <UserRound size={16}/>}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {loading && <div className="teamrota-ai-message assistant"><span className="teamrota-ai-avatar"><Bot size={16}/></span><p className="teamrota-ai-typing"><Loader2 size={16}/> TeamRota is checking…</p></div>}
            <div ref={endRef}/>
          </div>
          {messages.length <= 1 && <div className="teamrota-ai-quick">{c.quick.map((q) => <button type="button" key={q} onClick={() => void ask(q)}>{q}</button>)}</div>}
          <form className="teamrota-ai-form" onSubmit={submit}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={c.placeholder} maxLength={1000} disabled={loading}/>
            <button type="submit" disabled={loading || !input.trim()} aria-label={c.send}><Send size={18}/></button>
          </form>
          <footer className="teamrota-ai-footer">
            <span><HelpCircle size={13}/>{c.disclaimer}</span>
            <a href={`mailto:${HR_CONTACT_EMAIL}?subject=TeamRota%20HR%20Support`}>{c.contact}<ExternalLink size={12}/></a>
          </footer>
        </section>
      )}
      <button className="teamrota-ai-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-label={c.title}>
        {open ? <X size={23}/> : <><MessageCircle size={23}/><span>{c.title}</span></>}
      </button>
    </div>
  );
}
