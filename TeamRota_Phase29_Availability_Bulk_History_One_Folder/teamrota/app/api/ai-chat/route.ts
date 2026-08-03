import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Language = "en" | "ku" | "ar" | "ur";

const APP_URL = process.env.TEAMROTA_APP_URL || "https://teamrota-one.vercel.app";
const HR_EMAIL = process.env.TEAMROTA_HR_CONTACT_EMAIL?.trim() || "reza.kamil@taurusenergy.com";

function clean(value: unknown, limit = 1200) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, limit);
}

function localizedFallback(language: Language) {
  if (language === "ku") {
    return `نەتوانیم وەڵامێکی دڵنیابەخش بدۆزمەوە. تکایە پەیوەندی بە بەڕێوەبەری ڕاستەوخۆ، HR یان ئەدمینی TeamRota بکە. ئیمەیڵی HR: ${HR_EMAIL}`;
  }
  if (language === "ar") {
    return `لم أتمكن من العثور على إجابة موثوقة. يرجى التواصل مع مديرك المباشر أو الموارد البشرية أو مسؤول TeamRota. بريد الموارد البشرية: ${HR_EMAIL}`;
  }
  if (language === "ur") {
    return `مجھے قابل اعتماد جواب نہیں ملا۔ براہ کرم اپنے لائن منیجر، HR یا TeamRota ایڈمن سے رابطہ کریں۔ HR ای میل: ${HR_EMAIL}`;
  }
  return `I could not find a reliable answer. Please contact your Line Manager, HR, or the TeamRota Administrator. HR email: ${HR_EMAIL}`;
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function directAnswer(question: string, context: any, language: Language): string | null {
  const q = question.toLowerCase();
  const t = (en: string, ku: string, ar: string, ur: string) => language === "ku" ? ku : language === "ar" ? ar : language === "ur" ? ur : en;

  if (/who is my (line )?manager|my manager|بەڕێوەبەری من|مديري|میرا.*منیجر|لائن منیجر/.test(q)) {
    return context.manager?.full_name
      ? t(`Your Line Manager is ${context.manager.full_name}.`, `بەڕێوەبەری ڕاستەوخۆت ${context.manager.full_name} ـە.`, `مديرك المباشر هو ${context.manager.full_name}.`, `آپ کے لائن منیجر ${context.manager.full_name} ہیں۔`)
      : localizedFallback(language);
  }

  if (/leave balance|annual leave.*remain|remaining leave|باڵانسی مۆڵەت|رصيد.*إجاز|چھٹی.*بیلنس|کتنی.*چھٹی/.test(q)) {
    if (!context.leave_balances?.length) return localizedFallback(language);
    const lines = context.leave_balances.map((b: any) => {
      const total = Number(b.entitled || 0) + Number(b.carried_forward || 0) + Number(b.adjustment || 0);
      const remaining = total - Number(b.used || 0);
      return `${b.leave_types?.name || b.leave_types?.code || "Leave"}: ${remaining}`;
    });
    return `${t("Your current leave balances are:", "باڵانسەکانی مۆڵەتت:", "أرصدة إجازاتك الحالية:", "آپ کی موجودہ چھٹی کے بیلنس:")}\n${lines.join("\n")}`;
  }

  if (/how.*submit.*leave|submit leave|داواکاری مۆڵەت|طلب إجازة|چھٹی.*درخواست|درخواست.*چھٹی/.test(q)) {
    return t(
      `Open Leave & Balances, complete the request form, attach supporting documentation when required, and submit it to your assigned approver: ${APP_URL}/leave`,
      `بڕۆ بۆ مۆڵەت و باڵانسەکان، فۆڕمەکە پڕ بکەرەوە و ئەگەر پێویست بوو بەڵگە باربکە، پاشان بینێرە بۆ پەسەندکەر: ${APP_URL}/leave`,
      `افتح صفحة الإجازات والأرصدة، أكمل النموذج وأرفق المستند المطلوب ثم أرسله إلى المعتمد: ${APP_URL}/leave`,
      `چھٹیاں اور بیلنس کھولیں، فارم مکمل کریں، ضرورت کے مطابق دستاویز منسلک کریں اور منظور کنندہ کو جمع کریں: ${APP_URL}/leave`
    );
  }

  if (/how.*submit.*overtime|submit overtime|کاتی زیادە|عمل إضافي|اوور ٹائم/.test(q)) {
    return t(
      `Open Overtime, enter the date, start/end times, break, and business justification, then submit for approval: ${APP_URL}/overtime`,
      `بڕۆ بۆ کاتی زیادە، بەروار و کاتی دەستپێک/کۆتایی و پاساو بنووسە و بینێرە بۆ پەسەندکردن: ${APP_URL}/overtime`,
      `افتح صفحة العمل الإضافي، أدخل التاريخ ووقت البداية والنهاية والاستراحة والتبرير ثم أرسل للموافقة: ${APP_URL}/overtime`,
      `اوور ٹائم صفحہ کھولیں، تاریخ، آغاز و اختتام کا وقت، وقفہ اور جواز درج کریں، پھر منظوری کے لیے جمع کریں: ${APP_URL}/overtime`
    );
  }

  if (/timesheet|خشتەی کات|سجل الدوام|ٹائم شیٹ/.test(q) && /where|open|submit|چۆن|أين|كيف|کہاں|کیسے|جمع/.test(q)) {
    return t(
      `Open Monthly Timesheets here: ${APP_URL}/timesheets. Review the month, submit it to your Line Manager, then it proceeds to HR audit and Payroll.`,
      `خشتەی کاتی مانگانە لێرە بکەرەوە: ${APP_URL}/timesheets. پشکنینی بکە و بینێرە بۆ بەڕێوەبەرت؛ دواتر بۆ HR و مووچە دەچێت.`,
      `افتح سجل الدوام الشهري هنا: ${APP_URL}/timesheets. راجع الشهر ثم أرسله إلى المدير، وبعد ذلك ينتقل لتدقيق الموارد البشرية والرواتب.`,
      `ماہانہ ٹائم شیٹ یہاں کھولیں: ${APP_URL}/timesheets۔ مہینہ چیک کریں، لائن منیجر کو جمع کریں، پھر یہ HR آڈٹ اور پے رول کو جائے گی۔`
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to use TeamRota Assistant." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const question = clean(body?.message, 1000);
    const language: Language = body?.language === "ku" || body?.language === "ar" || body?.language === "ur" ? body.language : "en";
    const history: ChatMessage[] = Array.isArray(body?.history)
      ? body.history.slice(-8).map((m: any) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: clean(m?.content, 700) }))
      : [];

    if (question.length < 2) return NextResponse.json({ error: "Please enter a question." }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id,full_name,email,employee_no,job_title,app_role,manager_id,leave_approver_id,department_id,office_location")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Employee profile was not found." }, { status: 404 });

    const admin = createAdminClient();
    const provisionYear = new Date().getUTCFullYear();
    await admin.rpc("ensure_employee_leave_balances", { target_year: provisionYear });
    await admin.rpc("ensure_employee_leave_balances", { target_year: provisionYear + 1 });

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const future = new Date(today);
    future.setDate(future.getDate() + 30);
    const futureKey = future.toISOString().slice(0, 10);
    const year = today.getUTCFullYear();

    const [managerR, balancesR, leaveR, overtimeR, timesheetR, holidaysR, rotaR] = await Promise.all([
      profile.manager_id
        ? supabase.from("profiles").select("full_name,email,job_title").eq("id", profile.manager_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("leave_balances")
        .select("entitled,used,carried_forward,adjustment,carried_forward_expires_on,leave_types(name,code,entitlement_unit)")
        .eq("employee_id", user.id).eq("leave_year", year),
      supabase.from("leave_requests")
        .select("status,start_date,end_date,requested_days,decision_comment,leave_types(name,code)")
        .eq("employee_id", user.id).order("created_at", { ascending: false }).limit(8),
      supabase.from("overtime_requests")
        .select("status,overtime_date,requested_hours,decision_comment")
        .eq("employee_id", user.id).order("created_at", { ascending: false }).limit(8),
      supabase.from("timesheets")
        .select("timesheet_year,timesheet_month,status,manager_approved_at,hr_audited_at,payroll_sent_at,completed_at")
        .eq("employee_id", user.id).order("timesheet_year", { ascending: false }).order("timesheet_month", { ascending: false }).limit(4),
      supabase.from("holidays")
        .select("name,holiday_date,start_date,end_date,holiday_type")
        .eq("active", true).gte("holiday_date", todayKey).lte("holiday_date", futureKey).order("holiday_date").limit(8),
      supabase.from("rota_assignments")
        .select("work_date,status_code,shift_start,shift_end,note")
        .eq("employee_id", user.id).gte("work_date", todayKey).lte("work_date", futureKey).order("work_date").limit(31),
    ]);

    const context = {
      profile: {
        full_name: profile.full_name,
        employee_no: profile.employee_no,
        job_title: profile.job_title,
        app_role: profile.app_role,
        department_id: profile.department_id,
        office_location: profile.office_location,
      },
      manager: managerR.data,
      leave_balances: balancesR.data || [],
      recent_leave_requests: leaveR.data || [],
      recent_overtime_requests: overtimeR.data || [],
      recent_timesheets: timesheetR.data || [],
      upcoming_holidays: holidaysR.data || [],
      upcoming_rota_overrides: rotaR.data || [],
      links: {
        dashboard: `${APP_URL}/dashboard`, leave: `${APP_URL}/leave`, overtime: `${APP_URL}/overtime`,
        rota: `${APP_URL}/rota`, annual_rota: `${APP_URL}/year-rota`, timesheets: `${APP_URL}/timesheets`, profile: `${APP_URL}/profile`,
      },
      escalation: { hr_email: HR_EMAIL },
    };

    const direct = directAnswer(question, context, language);
    let answer = direct;
    let source = direct ? "live-data" : "fallback";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!answer && apiKey) {
      const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID?.trim();
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
      const languageInstruction = language === "ku"
        ? "Reply in Kurdish Sorani. Keep TeamRota page names recognizable."
        : language === "ar" ? "Reply in clear Arabic."
        : language === "ur" ? "Reply in clear professional Urdu. Keep TeamRota page names recognizable."
        : "Reply in clear professional English.";

      const instructions = `You are TeamRota Assistant, a controlled workforce and HR help assistant for Miran Energy.
${languageInstruction}
Rules:
- For questions about the employee, TeamRota, Miran policies, balances, approvals, rota, overtime, timesheets, or reporting lines, use only the supplied authorized context and approved HR documents.
- You may answer general workplace, communication, productivity, and TeamRota how-to questions using general knowledge, but clearly say when the answer is general guidance rather than Miran Energy policy.
- Never invent leave balances, approvals, rota dates, policies, reporting lines, or timesheet status.
- Never reveal passwords, authentication secrets, medical-document contents, API keys, tokens, or information about other employees.
- The live context belongs only to the signed-in employee. Do not answer questions requesting another employee's private data.
- Explain that formal employment, payroll, disciplinary, legal, medical, or policy decisions must be confirmed by HR.
- When a company-specific answer is missing or uncertain, say you could not confirm it and direct the user to their Line Manager, HR (${HR_EMAIL}), or TeamRota Admin. For a safe general question, provide a useful general answer instead of immediately refusing.
- Include the most relevant TeamRota link from the supplied links when useful.
- Keep the response under 220 words and use short paragraphs.`;

      const tools = vectorStoreId ? [{ type: "file_search", vector_store_ids: [vectorStoreId], max_num_results: 5 }] : undefined;
      const apiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          instructions,
          input: [
            { role: "user", content: [{ type: "input_text", text: `AUTHORIZED LIVE CONTEXT:\n${JSON.stringify(context)}\n\nRECENT CONVERSATION:\n${JSON.stringify(history)}\n\nEMPLOYEE QUESTION:\n${question}` }] }
          ],
          ...(tools ? { tools } : {}),
          max_output_tokens: 650,
          store: false,
        }),
        cache: "no-store",
      });

      const payload = await apiResponse.json().catch(() => ({}));
      if (apiResponse.ok) {
        answer = extractOutputText(payload) || localizedFallback(language);
        source = vectorStoreId ? "ai-and-knowledge" : "ai-and-live-data";
      } else {
        console.error("OpenAI response error", apiResponse.status, payload?.error?.message || payload);
      }
    }

    answer ||= localizedFallback(language);

    try {
      await admin.from("ai_chat_logs").insert({
        employee_id: user.id,
        question: question.slice(0, 2000),
        answer: answer.slice(0, 5000),
        answer_source: source,
        language,
      });
    } catch {
      // Optional audit table may not be installed yet. Chat should still work.
    }

    return NextResponse.json({ answer, source });
  } catch (error) {
    console.error("TeamRota AI chat error", error);
    return NextResponse.json({ error: "TeamRota Assistant is temporarily unavailable. Please contact HR or Admin." }, { status: 500 });
  }
}
