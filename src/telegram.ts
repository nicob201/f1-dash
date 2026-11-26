// Telegram Bot API con fetch directo.
export type SendResult = { ok: true } | { ok: false; status: number | null; description: string }

export async function sendMessage(token: string, chatId: string, html: string, fetcher: typeof fetch = fetch): Promise<SendResult> {
  let status: number | null = null
  try {
    const res = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(8000),
    })
    status = res.status
    const data = (await res.json()) as { ok: boolean; description?: string }
    return data.ok ? { ok: true } : { ok: false, status, description: data.description ?? 'sin descripción' }
  } catch (e) {
    // Solo el nombre: el mensaje del error puede traer la URL, que contiene el token.
    return { ok: false, status, description: e instanceof Error ? e.name : 'error' }
  }
}

/** Un chat privado es un id positivo. Los canales y grupos son `@nombre` o un id negativo. */
export const isPrivateChat = (chatId: string): boolean => /^\d+$/.test(chatId)
