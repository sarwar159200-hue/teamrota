"use client";

import { useEffect, useState } from "react";

type Language = "en" | "ku" | "ar" | "ur";

const ku: Record<string, string> = {
  "Dashboard": "داشبۆرد",
  "Organization Chart": "هێڵکاری ڕێکخراو",
  "Employee Directory": "بەڵگەنامەی کارمەندان",
  "People & Structure": "خەڵک و پێکهاتە",
  "Rota Planner": "پلاندانەری ڕۆتا",
  "Annual Rota": "ڕۆتای ساڵانە",
  "Holiday Calendar": "ڕۆژژمێری پشوو",
  "Leave & Balances": "مۆڵەت و باڵانسەکان",
  "Overtime": "کاتی زیادە",
  "Timesheets": "خشتەی کات",
  "My Profile & Settings": "پرۆفایل و ڕێکخستنەکانم",
  "Admin Workspace": "شوێنی کاری ئەدمین",
  "Holiday Settings": "ڕێکخستنەکانی پشوو",
  "Email Diagnostics": "پشکنینی ئیمەیڵ",
  "Sign out": "چوونەدەرەوە",
  "ORGANIZATION": "ڕێکخراو",
  "WORKFORCE": "هێزی کار",
  "ADMINISTRATION": "بەڕێوەبردن",
  "Leave": "مۆڵەت",
  "LEAVE": "مۆڵەت",
  "Request Leave": "داواکاری مۆڵەت",
  "Leave History": "مێژووی مۆڵەت",
  "Pending My Approval": "چاوەڕوانی پەسەندکردنی من",
  "Approve": "پەسەندکردن",
  "Reject": "ڕەتکردنەوە",
  "Amend decision": "گۆڕینی بڕیار",
  "Change to approved": "گۆڕین بۆ پەسەندکراو",
  "Change to rejected": "گۆڕین بۆ ڕەتکراوە",
  "Amendment reason": "هۆکاری گۆڕین",
  "Submit request": "ناردنی داواکاری",
  "Supporting document": "بەڵگەی پشتگیری",
  "Open supporting document": "کردنەوەی بەڵگەی پشتگیری",
  "View document": "بینینی بەڵگە",
  "Decision comment": "تێبینی بڕیار",
  "Reason / justification": "هۆکار / پاساو",
  "Leave type *": "جۆری مۆڵەت *",
  "Entitled": "مافی هەیە",
  "Used": "بەکارهاتوو",
  "Remaining": "ماوە",
  "Carry-forward": "گواستنەوە",
  "Configured": "ڕێکخراوە",
  "Not configured": "ڕێکنەخراوە",
  "Provider": "دابینکەر",
  "Sender": "نێرەر",
  "Notification Diagnostics": "پشکنینی ئاگادارکردنەوە",
  "Leave notifications": "ئاگادارکردنەوەکانی مۆڵەت",
  "Overtime notifications": "ئاگادارکردنەوەکانی کاتی زیادە",
  "No notification records found.": "هیچ تۆماری ئاگادارکردنەوەیەک نەدۆزرایەوە.",
  "Workforce Rota Planner": "پلاندانەری ڕۆتای هێزی کار",
  "Start date": "بەرواری دەستپێک",
  "Number of days": "ژمارەی ڕۆژەکان",
  "Employee": "کارمەند",
  "View rota": "بینینی ڕۆتا",
  "Print / Save PDF": "چاپ / پاشەکەوتکردنی PDF",
  "Visible employees": "کارمەندانی دیار",
  "Active rotations": "ڕۆتاکانی چالاک",
  "Manual assignments": "دانانە دەستییەکان",
  "Create Rotation Pattern": "دروستکردنی شێوازی ڕۆتا",
  "Assign Employee Rotation": "دانانی ڕۆتا بۆ کارمەند",
  "Manual Rota Override": "گۆڕینی دەستی ڕۆتا",
  "Save": "پاشەکەوتکردن",
  "Create": "دروستکردن",
  "Assign": "دانان",
  "ON – Day": "کار – ڕۆژ",
  "ON – Night": "کار – شەو",
  "OFF – Rest": "پشوو",
  "Public Holiday": "پشووی فەرمی",
  "Annual Leave": "مۆڵەتی ساڵانە",
  "Sick Leave": "مۆڵەتی نەخۆشی",
  "Maternity Leave": "مۆڵەتی دایکایەتی",
  "Marriage Leave": "مۆڵەتی هاوسەرگیری",
  "Unpaid Leave": "مۆڵەتی بێ مووچە",
  "Remote": "کار لە دوورەوە",
  "Travel": "گەشت",
  "Training": "ڕاهێنان",
  "Annual Rota Planner": "پلاندانەری ڕۆتای ساڵانە",
  "Total Year Rota": "کۆی ڕۆتای ساڵ",
  "View": "بینین",
  "January": "کانوونی دووەم",
  "February": "شوبات",
  "March": "ئازار",
  "April": "نیسان",
  "May": "ئایار",
  "June": "حوزەیران",
  "July": "تەمموز",
  "August": "ئاب",
  "September": "ئەیلوول",
  "October": "تشرینی یەکەم",
  "November": "تشرینی دووەم",
  "December": "کانوونی یەکەم",
  "Employees": "کارمەندان",
  "Active Employees": "کارمەندانی چالاک",
  "On Duty Today": "ئەمڕۆ لە کاردان",
  "On Leave Today": "ئەمڕۆ لە مۆڵەتدان",
  "Pending Requests": "داواکارییە چاوەڕوانەکان",
  "Pending Leave": "مۆڵەتی چاوەڕوان",
  "Departments": "بەشەکان",
  "Rota Entries Today": "تۆمارەکانی ڕۆتای ئەمڕۆ",
  "Pending Overtime": "کاتی زیادەی چاوەڕوان",
  "Organization Overview": "پوختەی ڕێکخراو",
  "Next Holiday": "پشووی داهاتوو",
  "Open calendar": "کردنەوەی ڕۆژژمێر",
  "Manage": "بەڕێوەبردن",
  "My Timesheets": "خشتە کاتەکانم",
  "Monthly Timesheets": "خشتە کاتی مانگانە",
  "Submit to manager": "ناردن بۆ بەڕێوەبەر",
  "Send to Payroll": "ناردن بۆ مووچە",
  "Mark Done": "نیشانکردن وەک تەواو",
  "Print": "چاپ",
  "Employee ID": "ژمارەی کارمەند",
  "Join date": "بەرواری دەستبەکاربوون",
  "Line Manager": "بەڕێوەبەری ڕاستەوخۆ",
  "Leave approver": "پەسەندکەری مۆڵەت",
  "Status": "دۆخ",
  "Date": "بەروار",
  "Day": "ڕۆژ",
  "Month": "مانگ",
  "Year": "ساڵ",
  "Shift": "شێفت",
  "Details": "وردەکاری",
  "Hours": "کاتژمێر",
  "Email address": "ناونیشانی ئیمەیڵ",
  "Password": "وشەی نهێنی",
  "Sign in": "چوونەژوورەوە",
  "Forgot password?": "وشەی نهێنیت لەبیرچووە؟",
  "Reset password": "نوێکردنەوەی وشەی نهێنی",
  "Temporary password": "وشەی نهێنی کاتی",
  "Set temporary password": "دانانی وشەی نهێنی کاتی",
  "Settings": "ڕێکخستنەکان",
  "Profile": "پرۆفایل",
  "Phone": "ژمارەی تەلەفۆن",
  "Job title": "ناونیشانی کار",
  "Gender": "ڕەگەز",
  "Male": "نێر",
  "Female": "مێ",
  "Create Employee Account": "دروستکردنی هەژماری کارمەند",
  "Create employee": "دروستکردنی کارمەند",
  "Secondary Reporting Lines": "هێڵەکانی ڕاپۆرتی دووەم",
  "Dotted-line manager": "بەڕێوەبەری هێڵی خاڵدار",
  "Reporting label": "ناونیشانی ڕاپۆرت",
  "Add dotted line": "زیادکردنی هێڵی خاڵدار",
  "Remove": "لابردن",
  "English": "English",
  "Kurdish (Sorani)": "کوردی (سۆرانی)",
  "Arabic": "العربية"
};

const ar: Record<string, string> = {
  "Dashboard": "لوحة التحكم",
  "Organization Chart": "الهيكل التنظيمي",
  "Employee Directory": "دليل الموظفين",
  "People & Structure": "الأفراد والهيكل",
  "Rota Planner": "مخطط المناوبات",
  "Annual Rota": "المناوبات السنوية",
  "Holiday Calendar": "تقويم العطل",
  "Leave & Balances": "الإجازات والأرصدة",
  "Overtime": "العمل الإضافي",
  "Timesheets": "سجلات الدوام",
  "My Profile & Settings": "ملفي وإعداداتي",
  "Admin Workspace": "مساحة الإدارة",
  "Holiday Settings": "إعدادات العطل",
  "Email Diagnostics": "تشخيص البريد الإلكتروني",
  "Sign out": "تسجيل الخروج",
  "ORGANIZATION": "المنظمة",
  "WORKFORCE": "القوى العاملة",
  "ADMINISTRATION": "الإدارة",
  "Leave": "إجازة",
  "LEAVE": "الإجازات",
  "Request Leave": "طلب إجازة",
  "Leave History": "سجل الإجازات",
  "Pending My Approval": "بانتظار موافقتي",
  "Approve": "موافقة",
  "Reject": "رفض",
  "Amend decision": "تعديل القرار",
  "Change to approved": "تغيير إلى موافق عليه",
  "Change to rejected": "تغيير إلى مرفوض",
  "Amendment reason": "سبب التعديل",
  "Submit request": "إرسال الطلب",
  "Supporting document": "المستند الداعم",
  "Open supporting document": "فتح المستند الداعم",
  "View document": "عرض المستند",
  "Decision comment": "ملاحظة القرار",
  "Reason / justification": "السبب / التبرير",
  "Leave type *": "نوع الإجازة *",
  "Entitled": "الاستحقاق",
  "Used": "المستخدم",
  "Remaining": "المتبقي",
  "Carry-forward": "المرحل",
  "Configured": "مُعد",
  "Not configured": "غير مُعد",
  "Provider": "المزود",
  "Sender": "المرسل",
  "Notification Diagnostics": "تشخيص الإشعارات",
  "Leave notifications": "إشعارات الإجازات",
  "Overtime notifications": "إشعارات العمل الإضافي",
  "No notification records found.": "لم يتم العثور على سجلات إشعارات.",
  "Workforce Rota Planner": "مخطط مناوبات القوى العاملة",
  "Start date": "تاريخ البدء",
  "Number of days": "عدد الأيام",
  "Employee": "الموظف",
  "View rota": "عرض المناوبة",
  "Print / Save PDF": "طباعة / حفظ PDF",
  "Visible employees": "الموظفون الظاهرون",
  "Active rotations": "المناوبات النشطة",
  "Manual assignments": "التعيينات اليدوية",
  "Create Rotation Pattern": "إنشاء نمط مناوبة",
  "Assign Employee Rotation": "تعيين مناوبة للموظف",
  "Manual Rota Override": "تعديل المناوبة يدوياً",
  "Save": "حفظ",
  "Create": "إنشاء",
  "Assign": "تعيين",
  "ON – Day": "دوام نهاري",
  "ON – Night": "دوام ليلي",
  "OFF – Rest": "راحة",
  "Public Holiday": "عطلة رسمية",
  "Annual Leave": "إجازة سنوية",
  "Sick Leave": "إجازة مرضية",
  "Maternity Leave": "إجازة أمومة",
  "Marriage Leave": "إجازة زواج",
  "Unpaid Leave": "إجازة بدون راتب",
  "Remote": "عمل عن بُعد",
  "Travel": "سفر",
  "Training": "تدريب",
  "Annual Rota Planner": "مخطط المناوبات السنوي",
  "Total Year Rota": "إجمالي مناوبات السنة",
  "View": "عرض",
  "January": "يناير",
  "February": "فبراير",
  "March": "مارس",
  "April": "أبريل",
  "May": "مايو",
  "June": "يونيو",
  "July": "يوليو",
  "August": "أغسطس",
  "September": "سبتمبر",
  "October": "أكتوبر",
  "November": "نوفمبر",
  "December": "ديسمبر",
  "Employees": "الموظفون",
  "Active Employees": "الموظفون النشطون",
  "On Duty Today": "على رأس العمل اليوم",
  "On Leave Today": "في إجازة اليوم",
  "Pending Requests": "الطلبات المعلقة",
  "Pending Leave": "الإجازات المعلقة",
  "Departments": "الأقسام",
  "Rota Entries Today": "سجلات مناوبة اليوم",
  "Pending Overtime": "العمل الإضافي المعلق",
  "Organization Overview": "نظرة عامة على المنظمة",
  "Next Holiday": "العطلة القادمة",
  "Open calendar": "فتح التقويم",
  "Manage": "إدارة",
  "My Timesheets": "سجلات دوامي",
  "Monthly Timesheets": "سجلات الدوام الشهرية",
  "Submit to manager": "إرسال إلى المدير",
  "Send to Payroll": "إرسال إلى الرواتب",
  "Mark Done": "وضع علامة مكتمل",
  "Print": "طباعة",
  "Employee ID": "رقم الموظف",
  "Join date": "تاريخ الالتحاق",
  "Line Manager": "المدير المباشر",
  "Leave approver": "معتمد الإجازة",
  "Status": "الحالة",
  "Date": "التاريخ",
  "Day": "اليوم",
  "Month": "الشهر",
  "Year": "السنة",
  "Shift": "الوردية",
  "Details": "التفاصيل",
  "Hours": "الساعات",
  "Email address": "عنوان البريد الإلكتروني",
  "Password": "كلمة المرور",
  "Sign in": "تسجيل الدخول",
  "Forgot password?": "هل نسيت كلمة المرور؟",
  "Reset password": "إعادة تعيين كلمة المرور",
  "Temporary password": "كلمة مرور مؤقتة",
  "Set temporary password": "تعيين كلمة مرور مؤقتة",
  "Settings": "الإعدادات",
  "Profile": "الملف الشخصي",
  "Phone": "الهاتف",
  "Job title": "المسمى الوظيفي",
  "Gender": "الجنس",
  "Male": "ذكر",
  "Female": "أنثى",
  "Create Employee Account": "إنشاء حساب موظف",
  "Create employee": "إنشاء موظف",
  "Secondary Reporting Lines": "خطوط التقارير الثانوية",
  "Dotted-line manager": "مدير الخط المنقط",
  "Reporting label": "وصف خط التقرير",
  "Add dotted line": "إضافة خط منقط",
  "Remove": "إزالة",
  "English": "English",
  "Kurdish (Sorani)": "کوردی",
  "Arabic": "العربية",
  "Urdu": "اردو"
};

const ur: Record<string, string> = {
  "Dashboard": "ڈیش بورڈ",
  "Organization Chart": "تنظیمی چارٹ",
  "Employee Directory": "ملازمین کی فہرست",
  "People & Structure": "افراد اور تنظیم",
  "Rota Planner": "روٹا پلانر",
  "Annual Rota": "سالانہ روٹا",
  "Holiday Calendar": "تعطیلات کا کیلنڈر",
  "Leave & Balances": "چھٹیاں اور بیلنس",
  "Overtime": "اوور ٹائم",
  "Timesheets": "ٹائم شیٹس",
  "My Profile & Settings": "میرا پروفائل اور سیٹنگز",
  "Admin Workspace": "ایڈمن ورک اسپیس",
  "Holiday Settings": "تعطیلات کی سیٹنگز",
  "Email Diagnostics": "ای میل تشخیص",
  "Sign out": "سائن آؤٹ",
  "ORGANIZATION": "تنظیم",
  "WORKFORCE": "افرادی قوت",
  "ADMINISTRATION": "انتظامیہ",
  "Leave": "چھٹی",
  "LEAVE": "چھٹی",
  "Request Leave": "چھٹی کی درخواست",
  "Leave History": "چھٹی کی تاریخ",
  "Pending My Approval": "میری منظوری کے منتظر",
  "Approve": "منظور کریں",
  "Reject": "مسترد کریں",
  "Submit request": "درخواست جمع کریں",
  "Supporting document": "معاون دستاویز",
  "Reason / justification": "وجہ / جواز",
  "Leave type *": "چھٹی کی قسم *",
  "Entitled": "استحقاق",
  "Used": "استعمال شدہ",
  "Remaining": "باقی",
  "Workforce Rota Planner": "افرادی قوت روٹا پلانر",
  "Start date": "شروع کی تاریخ",
  "Number of days": "دنوں کی تعداد",
  "Employee": "ملازم",
  "View rota": "روٹا دیکھیں",
  "Print / Save PDF": "پرنٹ / PDF محفوظ کریں",
  "Visible employees": "نظر آنے والے ملازمین",
  "Active rotations": "فعال روٹیشنز",
  "Manual assignments": "دستی اسائنمنٹس",
  "Save": "محفوظ کریں",
  "Create": "بنائیں",
  "Assign": "تفویض کریں",
  "Public Holiday": "سرکاری تعطیل",
  "Annual Leave": "سالانہ چھٹی",
  "Sick Leave": "بیماری کی چھٹی",
  "Unpaid Leave": "بلا معاوضہ چھٹی",
  "Remote": "ریموٹ",
  "Travel": "سفر",
  "Training": "تربیت",
  "Employees": "ملازمین",
  "Active Employees": "فعال ملازمین",
  "On Duty Today": "آج ڈیوٹی پر",
  "On Leave Today": "آج چھٹی پر",
  "Pending Leave": "زیر التوا چھٹی",
  "Departments": "محکمے",
  "Pending Overtime": "زیر التوا اوور ٹائم",
  "Next Holiday": "اگلی تعطیل",
  "My Timesheets": "میری ٹائم شیٹس",
  "Monthly Timesheets": "ماہانہ ٹائم شیٹس",
  "Submit to manager": "منیجر کو جمع کریں",
  "Send to Payroll": "پے رول کو بھیجیں",
  "Mark Done": "مکمل نشان زد کریں",
  "Print": "پرنٹ",
  "Employee ID": "ملازم نمبر",
  "Join date": "شمولیت کی تاریخ",
  "Line Manager": "لائن منیجر",
  "Status": "حالت",
  "Date": "تاریخ",
  "Day": "دن",
  "Month": "مہینہ",
  "Year": "سال",
  "Details": "تفصیلات",
  "Hours": "گھنٹے",
  "Email address": "ای میل ایڈریس",
  "Password": "پاس ورڈ",
  "Sign in": "سائن ان",
  "Forgot password?": "پاس ورڈ بھول گئے؟",
  "Reset password": "پاس ورڈ ری سیٹ کریں",
  "Settings": "سیٹنگز",
  "Profile": "پروفائل",
  "Phone": "فون",
  "Job title": "عہدہ",
  "Gender": "جنس",
  "Male": "مرد",
  "Female": "خاتون",
  "English": "English",
  "Kurdish (Sorani)": "کوردی",
  "Arabic": "العربية",
  "Urdu": "اردو"
};

function translateText(text: string, dictionary: Record<string, string>) {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const translated = dictionary[trimmed];
  if (!translated) return text;
  return text.replace(trimmed, translated);
}

function translateTree(root: ParentNode, dictionary: Record<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script,style,textarea,[data-no-translate]")) continue;
    node.textContent = translateText(node.textContent || "", dictionary);
  }

  root.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach((el) => {
    for (const attr of ["placeholder", "title", "aria-label"]) {
      const current = el.getAttribute(attr);
      if (current && dictionary[current.trim()]) el.setAttribute(attr, dictionary[current.trim()]);
    }
  });
}

export default function LanguageSwitcher() {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("teamrota-language") as Language | null;
    const selected: Language = saved === "ku" || saved === "ar" || saved === "ur" ? saved : "en";
    setLanguage(selected);

    document.documentElement.lang = selected === "ku" ? "ckb" : selected;
    document.documentElement.dir = selected === "en" ? "ltr" : "rtl";
    document.body.classList.toggle("language-ku", selected === "ku");
    document.body.classList.toggle("language-ar", selected === "ar");
    document.body.classList.toggle("language-ur", selected === "ur");

    const dictionary = selected === "ku" ? ku : selected === "ar" ? ar : selected === "ur" ? ur : null;
    if (dictionary) {
      translateTree(document.body, dictionary);
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) translateTree(node as Element, dictionary);
            if (node.nodeType === Node.TEXT_NODE && node.parentNode) translateTree(node.parentNode, dictionary);
          });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, []);

  function changeLanguage(next: Language) {
    if (next === language) return;
    localStorage.setItem("teamrota-language", next);
    window.location.reload();
  }

  return (
    <div className="language-switcher language-switcher-flags" data-no-translate aria-label="Language selector">
      <button type="button" className={language === "en" ? "active" : ""} onClick={() => changeLanguage("en")} title="English" aria-label="English">
        <img className="language-flag-image" src="/flags/uk.svg" alt="" aria-hidden="true"/>
        <span className="language-name">English</span>
      </button>
      <button type="button" className={language === "ku" ? "active" : ""} onClick={() => changeLanguage("ku")} title="Kurdish (Sorani)" aria-label="Kurdish (Sorani)">
        <img className="language-flag-image" src="/flags/krg.svg" alt="" aria-hidden="true"/>
        <span className="language-name">کوردی</span>
      </button>
      <button type="button" className={language === "ar" ? "active" : ""} onClick={() => changeLanguage("ar")} title="Arabic" aria-label="Arabic">
        <img className="language-flag-image" src="/flags/iraq.svg" alt="" aria-hidden="true"/>
        <span className="language-name">العربية</span>
      </button>
      <button type="button" className={language === "ur" ? "active" : ""} onClick={() => changeLanguage("ur")} title="Urdu" aria-label="Urdu">
        <img className="language-flag-image" src="/flags/pakistan.svg" alt="" aria-hidden="true"/>
        <span className="language-name">اردو</span>
      </button>
    </div>
  );
}
