import { WhatsAppWebhookProcessor } from "../src/webhookHandler.js";

const SIMULATED_META_PAYLOADS = [
  {
    messageId: "wamid.HBgMNTg0MTIwMDAxMTIyFQIAEhggMDE",
    fromPhone: "584120001122",
    timestamp: "2026-10-22T10:15:00Z",
    type: "text" as const,
    textBody: "Cedula: V-19823411 Ref: 0094827162 Monto: 35.00 USD Banco: Mercantil",
  },
  {
    messageId: "wamid.HBgMNTg0MTQwMDAzMzQ0FQIAEhggMDI",
    fromPhone: "584140003344",
    timestamp: "2026-10-22T10:18:20Z",
    type: "text" as const,
    // Positional unstructured format sent by customers in production
    textBody: "24910234 883920194 1420.50 BS Banesco",
  },
  {
    // Duplicate delivery of Payload #1 (Simulating Meta webhook network retry)
    messageId: "wamid.HBgMNTg0MTIwMDAxMTIyFQIAEhggMDE",
    fromPhone: "584120001122",
    timestamp: "2026-10-22T10:15:02Z",
    type: "text" as const,
    textBody: "Cedula: V-19823411 Ref: 0094827162 Monto: 35.00 USD Banco: Mercantil",
  },
  {
    messageId: "wamid.HBgMNTg0MjQwMDA1NTY2FQIAEhggMDM",
    fromPhone: "584240005566",
    timestamp: "2026-10-22T11:02:10Z",
    type: "interactive" as const,
    interactiveId: "falla_luz_roja",
    textBody: "Abonado: 109482 Sector: Urb. Las Palmas Calle 4. Tengo luz roja LOS en el equipo.",
  },
  {
    messageId: "wamid.HBgMNTg0MTYwMDA3Nzg4FQIAEhggMDQ",
    fromPhone: "584160007788",
    timestamp: "2026-10-22T11:30:45Z",
    type: "interactive" as const,
    interactiveId: "falla_intermitencia",
    textBody: "Contrato: 88391 Sector: Centro Av. Miranda. El servicio está intermitente.",
  },
];

async function runSimulation() {
  console.log("=========================================================================");
  console.log("  WHATSAPP + GEMINI B2B CONCILIATOR — WEBHOOK SANDBOX SIMULATOR (5 EVENTS)");
  console.log("=========================================================================\n");

  const processor = new WhatsAppWebhookProcessor();

  for (const [idx, payload] of SIMULATED_META_PAYLOADS.entries()) {
    const result = await processor.processIncomingWebhook(payload);
    console.log(`[Event #${idx + 1}] messageId=${payload.messageId}`);
    console.log(JSON.stringify(result, null, 2));
    console.log("-------------------------------------------------------------------------");
  }
}

runSimulation().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
