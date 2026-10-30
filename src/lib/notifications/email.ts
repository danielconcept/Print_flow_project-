import { getEmailConfig } from "@/lib/env";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string }> {
  const config = getEmailConfig();
  if (!config) {
    return { ok: false };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(config.apiKey);
    const result = await resend.emails.send({
      from: config.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (result.error) {
      return { ok: false };
    }
    return { ok: true, id: result.data?.id };
  } catch {
    return { ok: false };
  }
}
