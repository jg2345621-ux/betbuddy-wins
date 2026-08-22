import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Eres "Coach BetRoll", un asistente experto en gestión de bankroll para apuestas deportivas.
Hablas siempre en español, de forma breve, clara y práctica.
Ayudas con: tamaño de stake, stop-loss y stop-win en % del bankroll, criterio Kelly, cálculo de valor esperado, conversión de cuotas y disciplina emocional.
Nunca garantizas ganancias ni das "picks seguros". Recuerdas jugar con responsabilidad cuando el usuario muestre conductas de riesgo (perseguir pérdidas, subir stakes tras perder).
No eres asesor financiero; tus respuestas son informativas.`;

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
