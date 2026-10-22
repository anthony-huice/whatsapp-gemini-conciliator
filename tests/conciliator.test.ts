import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WhatsAppWebhookProcessor } from "../src/webhookHandler.js";
import {
  extractPaymentFallbackJS,
  triageTechnicalIncident,
} from "../src/conciliatorEngine.js";

describe("WhatsApp + Gemini B2B Conciliator & NOC Triage Suite", () => {
  it("extracts labeled payment reports with strict Zod validation", () => {
    const res = extractPaymentFallbackJS(
      "Cedula: V-18992011 Ref: 994827162 Monto: 45.00 USD Banco: Banesco",
      "584120001122",
      "2026-10-22"
    );

    assert.equal(res.customerIdentifier, "V-18992011");
    assert.equal(res.referenceNumber, "994827162");
    assert.equal(res.amount, 45.0);
    assert.equal(res.currency, "USD");
    assert.equal(res.originBank, "Banesco");
    assert.equal(res.extractionEngine, "heuristic-fallback");
  });

  it("extracts unstructured positional payment tokens when labels are omitted", () => {
    const res = extractPaymentFallbackJS(
      "25901823 778192031 1380.50 BS mercantil",
      "584140003344",
      "2026-10-22"
    );

    assert.equal(res.customerIdentifier, "25901823");
    assert.equal(res.referenceNumber, "778192031");
    assert.equal(res.amount, 1380.5);
    assert.equal(res.currency, "VES");
    assert.equal(res.originBank, "Mercantil");
  });

  it("classifies OPTICAL_LOS incidents as CRITICAL and flags field crew dispatch", () => {
    const triage = triageTechnicalIncident(
      "Abonado: 449102 Sector: Urb. Los Pinos. Tengo luz roja en el equipo ONU.",
      "584240005566",
      "falla_luz_roja"
    );

    assert.equal(triage.category, "OPTICAL_LOS");
    assert.equal(triage.severity, "CRITICAL");
    assert.equal(triage.requiresFieldDispatch, true);
    assert.equal(triage.subscriberId, "449102");
  });

  it("enforces O(1) webhook idempotency by ignoring duplicate Meta message_id deliveries", async () => {
    const processor = new WhatsAppWebhookProcessor();
    const payload = {
      messageId: "wamid.TEST_IDEMPOTENCY_001",
      fromPhone: "584120009988",
      timestamp: "2026-10-22T12:00:00Z",
      type: "text" as const,
      textBody: "Cedula: V-20112233 Ref: 123456789 Monto: 30 USD Banco: Zelle",
    };

    const firstAttempt = await processor.processIncomingWebhook(payload);
    const duplicateAttempt = await processor.processIncomingWebhook(payload);

    assert.equal(firstAttempt.status, "PAYMENT_RECONCILED");
    assert.equal(duplicateAttempt.status, "DUPLICATE_IGNORED");
  });
});
