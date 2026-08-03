import nodemailer from "nodemailer";

type EmailPayload = {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  idempotencyKey: string;
};

export type EmailDeliveryResult = {
  status: "sent" | "failed" | "skipped";
  id: string | null;
  error: string | null;
};

function uniqueEmails(emails: string[] = []) {
  return [
    ...new Set(
      emails
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

export function emailConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  return {
    configured: Boolean(
      host &&
        port &&
        user &&
        password &&
        from
    ),
    from:
      from ||
      (user
        ? `Miran Energy TeamRota <${user}>`
        : "Miran Energy TeamRota"),
    provider: "Gmail SMTP",
  };
}

export async function sendSystemEmail(
  payload: EmailPayload
): Promise<EmailDeliveryResult> {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    (user
      ? `Miran Energy TeamRota <${user}>`
      : "");

  const recipients = uniqueEmails(payload.to);

  const cc = uniqueEmails(payload.cc).filter(
    (email) => !recipients.includes(email)
  );

  if (!host || !user || !password || !from) {
    return {
      status: "skipped",
      id: null,
      error:
        "Gmail SMTP is not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM in Vercel.",
    };
  }

  if (recipients.length === 0) {
    return {
      status: "skipped",
      id: null,
      error:
        "No recipient email addresses are available.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass: password,
      },
    });

    const result = await transporter.sendMail({
      from,
      to: recipients.join(", "),
      cc: cc.length > 0 ? cc.join(", ") : undefined,
      subject: payload.subject,
      html: payload.html,
      replyTo: user,
      headers: {
        "X-TeamRota-Idempotency-Key":
          payload.idempotencyKey,
      },
    });

    return {
      status: "sent",
      id: result.messageId || null,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected Gmail SMTP error.";

    console.error(
      "Gmail SMTP delivery failed:",
      error
    );

    return {
      status: "failed",
      id: null,
      error: message,
    };
  }
}
