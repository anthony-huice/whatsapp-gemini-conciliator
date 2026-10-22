import { z } from "zod";

/**
 * Schema 1: Universal B2B Payment Report Extraction (PaymentReportExtraction)
 * Validates structured payment reconciliation payloads extracted from unstructured
 * WhatsApp text messages or receipt captions.
 */
export const PaymentReportExtractionSchema = z.object({
  customerIdentifier: z
    .string()
    .min(4, "Customer ID or Tax ID is required"),
  referenceNumber: z
    .string()
    .min(4, "Bank reference number must contain at least 4 characters"),
  amount: z
    .number()
    .positive("Transaction amount must be greater than zero"),
  currency: z.enum(["USD", "VES", "EUR"]).default("USD"),
  originBank: z.string().min(2, "Origin bank or payment platform is required"),
  paymentDate: z.string(),
  senderPhone: z.string(),
  extractionEngine: z.enum(["gemini-2.0-flash", "heuristic-fallback"]),
});

export type PaymentReportExtraction = z.infer<
  typeof PaymentReportExtractionSchema
>;

/**
 * Schema 2: Automated NOC Technical Incident Triage (TechnicalIncidentTriage)
 * Classifies customer-reported connectivity/service incidents into actionable
 * NOC engineering categories and severity levels.
 */
export const IncidentCategoryEnum = z.enum([
  "OPTICAL_LOS",
  "INTERMITTENT_PACKET_LOSS",
  "HIGH_LATENCY",
  "DNS_ROUTING",
  "NO_DATA_LINK",
]);

export const IncidentSeverityEnum = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const TechnicalIncidentTriageSchema = z.object({
  subscriberId: z.string(),
  category: IncidentCategoryEnum,
  severity: IncidentSeverityEnum,
  coordinatesOrAddress: z.string(),
  structuredSummary: z.string(),
  requiresFieldDispatch: z.boolean(),
  senderPhone: z.string(),
  extractionEngine: z.enum(["gemini-2.0-flash", "heuristic-fallback"]),
});

export type TechnicalIncidentTriage = z.infer<
  typeof TechnicalIncidentTriageSchema
>;

/**
 * Schema 3: Incoming Meta WhatsApp Cloud API Webhook Envelope
 */
export const WhatsAppWebhookMessageSchema = z.object({
  messageId: z.string().min(5),
  fromPhone: z.string().min(7),
  timestamp: z.string(),
  type: z.enum(["text", "interactive", "image"]),
  textBody: z.string().optional(),
  interactiveId: z.string().optional(),
  mediaId: z.string().optional(),
});

export type WhatsAppWebhookMessage = z.infer<
  typeof WhatsAppWebhookMessageSchema
>;
