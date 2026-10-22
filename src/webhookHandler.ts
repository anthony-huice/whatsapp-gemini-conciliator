import {
  extractPaymentReport,
  triageTechnicalIncident,
} from "./conciliatorEngine.js";
import {
  PaymentReportExtraction,
  TechnicalIncidentTriage,
  WhatsAppWebhookMessage,
  WhatsAppWebhookMessageSchema,
} from "./schemas.js";

export type WebhookProcessingResult =
  | {
      status: "DUPLICATE_IGNORED";
      messageId: string;
    }
  | {
      status: "PAYMENT_RECONCILED";
      messageId: string;
      data: PaymentReportExtraction;
    }
  | {
      status: "INCIDENT_TRIAGED";
      messageId: string;
      data: TechnicalIncidentTriage;
    };

/**
 * Stateful/Idempotent Webhook Processor that enforces O(1) deduplication by
 * Meta's `wamid` (`messageId`) so webhook network retries never create duplicate
 * payment records or duplicate NOC tickets.
 */
export class WhatsAppWebhookProcessor {
  private readonly processedMessageIds = new Set<string>();

  public async processIncomingWebhook(
    rawPayload: unknown
  ): Promise<WebhookProcessingResult> {
    const msg: WhatsAppWebhookMessage =
      WhatsAppWebhookMessageSchema.parse(rawPayload);

    // 1. Idempotency Guard: reject already-processed Meta message_id
    if (this.processedMessageIds.has(msg.messageId)) {
      return {
        status: "DUPLICATE_IGNORED",
        messageId: msg.messageId,
      };
    }

    this.processedMessageIds.add(msg.messageId);

    const body = msg.textBody || "";
    const isIncident =
      (msg.interactiveId && msg.interactiveId.startsWith("falla_")) ||
      /\b(luz roja|falla|sin internet|lento|intermitente|cortada|aver[ií]a)\b/i.test(
        body
      );

    if (isIncident) {
      const triage = triageTechnicalIncident(
        body,
        msg.fromPhone,
        msg.interactiveId
      );
      return {
        status: "INCIDENT_TRIAGED",
        messageId: msg.messageId,
        data: triage,
      };
    }

    const payment = await extractPaymentReport(body, msg.fromPhone, {
      referenceDateIso: msg.timestamp.slice(0, 10),
    });

    return {
      status: "PAYMENT_RECONCILED",
      messageId: msg.messageId,
      data: payment,
    };
  }
}
