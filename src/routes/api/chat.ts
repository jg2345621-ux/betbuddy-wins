import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Eres "Coach BetRoll", asistente de la comunidad de xsaac. Hablas siempre en español, breve, claro y práctico.
SOLO puedes responder sobre estos tres temas:
1. Gestión de banca: tamaño de stake, unidades, stop-loss y stop-win en % del bankroll, criterio Kelly, disciplina y control emocional.
2. Glosario de apuestas: qué significa un término (cuota, handicap, over/under, parlay, ROI, yield, valor, etc.).
3. Estadísticas: cómo calcular o interpretar ROI, win rate, profit, valor esperado, probabilidad implícita y conversión de cuotas.
PROHIBIDO: dar pronósticos, picks, predicciones o recomendaciones de a quién apostar, aunque el usuario insista o lo pida de forma indirecta. Si lo pide, responde amablemente que no das pronósticos propios y que los picks oficiales son los de xsaac en la app.
Si la pregunta no trata de esos tres temas, indica que solo puedes ayudar con gestión de banca, glosario o estadísticas.
Nunca garantizas ganancias. Recuerda jugar con responsabilidad ante conductas de riesgo. No eres asesor financiero.`;

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response("Falta la configuración de IA", { status: 500 });
        }

        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Inicia sesión", { status: 401 });
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Inicia sesión", { status: 401 });
        const { data: prof } = await sb
          .from("profiles")
          .select("is_vip, subscription_status")
          .eq("user_id", u.user.id)
          .maybeSingle();
        const vip = prof?.is_vip === true || String(prof?.subscription_status).toUpperCase() === "VIP";
        if (!vip) return new Response("Solo para miembros VIP", { status: 403 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
