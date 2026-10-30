import { getWhatsAppConfig } from "@/lib/env";

export interface WhatsAppPayload {
  to: string;
  message: string;
}

export async function sendWhatsApp(payload: WhatsAppPayload): Promise<{ ok: boolean }> {
  const config = getWhatsAppConfig();
  if (!config) {
    return { ok: false };
  }

  try {
    const response = await fetch(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: payload.to,
          type: "text",
          text: { body: payload.message },
        }),
      },
    );
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
