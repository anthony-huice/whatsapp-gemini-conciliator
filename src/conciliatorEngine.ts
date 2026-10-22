import {
  PaymentReportExtraction,
  PaymentReportExtractionSchema,
  TechnicalIncidentTriage,
  TechnicalIncidentTriageSchema,
} from "./schemas.js";

const KNOWN_BANKS_REGEX =
  /\b(banesco|mercantil|provincial|bbva|venezuela|bdv|bancamiga|bnc|bancaribe|zelle|binance|zinli|wally|stripe|paypal)\b/i;

/**
 * Multi-stage deterministic heuristic parser (0% downtime fallback when LLM API is unreachable).
 * Supports both labeled messages ("Ref: 98412031 Monto: 45.50 USD") and positional
 * space/comma-separated strings ("24819201 98412031 45.50 Mercantil").
 */
export function extractPaymentFallbackJS(
  rawText: string,
  senderPhone: string,
  referenceDateIso = new Date().toISOString().slice(0, 10)
): PaymentReportExtraction {
  const txt = (rawText || "").trim();

  const idMatch = txt.match(
    /(?:cedula|cédula|id|abonado|ci|rif|v-?)\s*:?\s*([VvEeJjPp]?-?\d{6,10})/i
  );
  const refMatch = txt.match(
    /(?:ref|referencia|comprobante|nro|num|#)\s*:?\s*(\d{6,16})/i
  );
  const amountLabeledMatch = txt.match(
    /(?:monto|pago|total|\$|usd|bs|ves)\s*:?\s*(\d+(?:[.,]\d{1,2})?)/i
  );
  const currencyMatch = txt.match(/\b(USD|VES|BS|EUR|\$)\b/i);
  const bankMatch = txt.match(KNOWN_BANKS_REGEX);

  const tokens = txt.split(/[\s,;\n]+/).filter(Boolean);
  const numericTokens = tokens.filter(
    (t) => /^\d+([.,]\d+)*$/.test(t) || /^[VvEeJjPp]-\d+$/.test(t)
  );

  const customerIdentifier =
    idMatch?.[1] || numericTokens[0] || "UNIDENTIFIED_SUBSCRIBER";
  const referenceNumber = refMatch?.[1] || numericTokens[1] || "000000";

  const rawAmountStr =
    amountLabeledMatch?.[1] || numericTokens[2] || "0";
  const normalizedAmount = parseFloat(rawAmountStr.replace(",", "."));
  const amount =
    !Number.isNaN(normalizedAmount) && normalizedAmount > 0
      ? normalizedAmount
      : 1.0;

  let currency: "USD" | "VES" | "EUR" = "USD";
  if (currencyMatch) {
    const token = currencyMatch[1].toUpperCase();
    if (token === "BS" || token === "VES") currency = "VES";
    else if (token === "EUR") currency = "EUR";
  }

  const rawBank = bankMatch?.[1] || "UNSPECIFIED_BANK";
  const originBank =
    rawBank.charAt(0).toUpperCase() + rawBank.slice(1).toLowerCase();

  return PaymentReportExtractionSchema.parse({
    customerIdentifier,
    referenceNumber,
    amount,
    currency,
    originBank,
    paymentDate: referenceDateIso,
    senderPhone,
    extractionEngine: "heuristic-fallback",
  });
}

/**
 * Extracts structured B2B payment data via Google Gemini 2.0 Flash with deterministic
 * temperature (0.1) and automatic failover to the local heuristic parser.
 */
export async function extractPaymentReport(
  rawText: string,
  senderPhone: string,
  options?: { apiKey?: string; referenceDateIso?: string }
): Promise<PaymentReportExtraction> {
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
  const dateIso =
    options?.referenceDateIso ?? new Date().toISOString().slice(0, 10);

  if (!apiKey) {
    return extractPaymentFallbackJS(rawText, senderPhone, dateIso);
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `Extract payment reconciliation fields from the following WhatsApp message and return ONLY a valid JSON object matching this exact structure:
{
  "customerIdentifier": "string (Customer ID, National ID, or Contract Number)",
  "referenceNumber": "string (Bank transaction reference number)",
  "amount": 0.00,
  "currency": "USD" | "VES" | "EUR",
  "originBank": "string (Bank or payment platform name)"
}

Message: "${rawText.replace(/"/g, '\\"')}"`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!res.ok) {
      return extractPaymentFallbackJS(rawText, senderPhone, dateIso);
    }

    const payload = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const jsonText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) {
      return extractPaymentFallbackJS(rawText, senderPhone, dateIso);
    }

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return PaymentReportExtractionSchema.parse({
      customerIdentifier: String(parsed.customerIdentifier || "UNIDENTIFIED"),
      referenceNumber: String(parsed.referenceNumber || "000000"),
      amount: Number(parsed.amount) > 0 ? Number(parsed.amount) : 1.0,
      currency:
        parsed.currency === "VES" || parsed.currency === "EUR"
          ? parsed.currency
          : "USD",
      originBank: String(parsed.originBank || "UNSPECIFIED_BANK"),
      paymentDate: dateIso,
      senderPhone,
      extractionEngine: "gemini-2.0-flash",
    });
  } catch {
    return extractPaymentFallbackJS(rawText, senderPhone, dateIso);
  }
}

/**
 * Classifies customer technical support incidents into NOC operational categories,
 * assigning severity and determining whether an on-site fiber/field crew is required.
 */
export function triageTechnicalIncident(
  rawText: string,
  senderPhone: string,
  interactiveCode?: string
): TechnicalIncidentTriage {
  const txt = (rawText || "").toLowerCase();
  const code = (interactiveCode || "").toLowerCase();

  const idMatch = rawText.match(/(?:abonado|contrato|id|ci|v-?)\s*:?\s*([VvEeJjPp]?-?\d{5,10})/i);
  const subscriberId = idMatch?.[1] || "SUB-PENDING";

  const locMatch = rawText.match(/(?:sector|urb|urbanizaci[oó]n|calle|direcci[oó]n|av)\s*:?\s*([^.,;\n]+)/i);
  const coordinatesOrAddress = locMatch?.[1]?.trim() || "Pending Geolocation";

  if (
    code === "falla_luz_roja" ||
    txt.includes("luz roja") ||
    txt.includes("los") ||
    txt.includes("fibra cortada")
  ) {
    return TechnicalIncidentTriageSchema.parse({
      subscriberId,
      category: "OPTICAL_LOS",
      severity: "CRITICAL",
      coordinatesOrAddress,
      structuredSummary:
        "Optical Loss of Signal (LOS) detected on customer ONU terminal. Physical fiber drop or NAP splitter inspection required.",
      requiresFieldDispatch: true,
      senderPhone,
      extractionEngine: "heuristic-fallback",
    });
  }

  if (
    code === "falla_sin_datos" ||
    txt.includes("sin internet") ||
    txt.includes("no recibe datos") ||
    txt.includes("wan desconectado")
  ) {
    return TechnicalIncidentTriageSchema.parse({
      subscriberId,
      category: "NO_DATA_LINK",
      severity: "HIGH",
      coordinatesOrAddress,
      structuredSummary:
        "Optical link active but PPPoE/DHCP WAN session is down. Requires NOC OLT profile verification.",
      requiresFieldDispatch: false,
      senderPhone,
      extractionEngine: "heuristic-fallback",
    });
  }

  if (
    code === "falla_intermitencia" ||
    txt.includes("intermitente") ||
    txt.includes("se cae") ||
    txt.includes("microcortes")
  ) {
    return TechnicalIncidentTriageSchema.parse({
      subscriberId,
      category: "INTERMITTENT_PACKET_LOSS",
      severity: "MEDIUM",
      coordinatesOrAddress,
      structuredSummary:
        "Intermittent packet loss reported. Check optical attenuation (dBm) and Wi-Fi channel interference.",
      requiresFieldDispatch: false,
      senderPhone,
      extractionEngine: "heuristic-fallback",
    });
  }

  if (
    code === "falla_paginas" ||
    txt.includes("no abren") ||
    txt.includes("dns")
  ) {
    return TechnicalIncidentTriageSchema.parse({
      subscriberId,
      category: "DNS_ROUTING",
      severity: "LOW",
      coordinatesOrAddress,
      structuredSummary:
        "Selective domain resolution failure. Verify upstream DNS resolvers or BGP routing.",
      requiresFieldDispatch: false,
      senderPhone,
      extractionEngine: "heuristic-fallback",
    });
  }

  return TechnicalIncidentTriageSchema.parse({
    subscriberId,
    category: "HIGH_LATENCY",
    severity: "MEDIUM",
    coordinatesOrAddress,
    structuredSummary:
      "Throughput degradation or high latency reported during peak hours.",
    requiresFieldDispatch: false,
    senderPhone,
    extractionEngine: "heuristic-fallback",
  });
}
