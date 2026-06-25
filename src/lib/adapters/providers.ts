import { ProviderType } from '../store/usePlatformStore';

export interface ProviderCredentials {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

// Unified Schemas based on document keywords
export const INVOICE_SCHEMA_INSTRUCTIONS = `
Extract the following fields in JSON format:
{
  "invoice_number": "string (the invoice ID, e.g., INV-10022)",
  "invoice_date": "string (the billing date)",
  "vendor_name": "string (company issuing the invoice)",
  "client_name": "string (company being billed)",
  "subtotal": "number (amount before tax)",
  "tax": "number (tax amount)",
  "grand_total": "number (total billing amount)",
  "currency": "string (3-letter currency code, e.g., USD)",
  "payment_terms": "string (e.g., Net 30)",
  "routing_number": "string (routing code if available)",
  "account_number": "string (account number if available)",
  "line_items": [
    {
      "description": "string",
      "qty": "number",
      "unit_price": "number",
      "total": "number"
    }
  ]
}
`;

export const CONTRACT_SCHEMA_INSTRUCTIONS = `
Extract the following fields in JSON format:
{
  "agreement_type": "string (e.g., MASTER SERVICES AGREEMENT, NDA)",
  "effective_date": "string (effective date of agreement)",
  "provider": "string (first party name)",
  "client": "string (second party name)",
  "governing_law": "string (state or country governing the contract)",
  "signing_date_acme": "string or null (date provider signed, look for Acme Global services signing date)",
  "signing_date_innotech": "string or null (date client signed, look for InnoTech signing date)"
}
`;

export const GENERIC_SCHEMA_INSTRUCTIONS = `
Extract the key metrics and information from the document in JSON format:
{
  "document_type": "string (inferred type of document)",
  "report_date": "string (date of report)",
  "cpu_utilization_avg": "string (if available)",
  "memory_peak_allocation": "string (if available)",
  "inbound_throughput": "string (if available)",
  "outbound_throughput": "string (if available)",
  "error_rate_5xx": "string (if available)",
  "author": "string (author/publisher)"
}
`;

export function getSystemPromptForDocument(fileName: string, ocrText?: string): string {
  const lowerName = fileName.toLowerCase();
  const lowerOcr = (ocrText || '').toLowerCase();
  let schemaInstructions = GENERIC_SCHEMA_INSTRUCTIONS;

  if (lowerName.includes('invoice') || lowerName.includes('receipt') || lowerName.includes('bill') || lowerName.includes('charge') ||
      lowerOcr.includes('invoice') || lowerOcr.includes('receipt') || lowerOcr.includes('bill') || lowerOcr.includes('charge') || lowerOcr.includes('total')) {
    schemaInstructions = INVOICE_SCHEMA_INSTRUCTIONS;
  } else if (lowerName.includes('contract') || lowerName.includes('agreement') || lowerName.includes('nda') ||
             lowerOcr.includes('contract') || lowerOcr.includes('agreement') || lowerOcr.includes('nda') || lowerOcr.includes('master services agreement')) {
    schemaInstructions = CONTRACT_SCHEMA_INSTRUCTIONS;
  }

  return `You are an expert Document Intelligence Extraction AI. Your task is to ingest the following OCR text or images and extract structured fields with high precision.
  
Rules:
1. Read the text/images thoroughly. If a field is not present or cannot be inferred, set it to null. Do not hallucinate.
2. For numeric fields (subtotal, tax, grand_total, qty, unit_price), return them as numbers, not formatted strings (e.g., return 7000.00 instead of "$7,000.00").
3. You MUST estimate your confidence score (from 0 to 100) for each extracted field based on how clear, unambiguous, and present the field is in the text/images.
4. You MUST classify the document and include these two fields at the root of the "extracted_data" object:
   - "document_category": MUST be one of ["Bills", "Legal", "Operations", "Other"]
   - "document_subcategory": A specific descriptive tag representing the subcategory (e.g. "Software Subscription", "NDA", "Board Resolution", "System Performance Report", "Personal Letter", etc.)

You MUST respond ONLY with a valid JSON object matching the following envelope format, and no other text:
{
  "extracted_data": {
    "document_category": "string",
    "document_subcategory": "string",
    ... (the specific schema fields requested below)
  },
  "confidence_scores": <A flat JSON object mapping each primary extracted field name to a confidence score integer from 0 to 100. Example: {"document_category": 99, "invoice_number": 98}>
}

Schema instructions to extract:
${schemaInstructions}
`;
}

export interface FormattedPayload {
  url: string;
  headers: Record<string, string>;
  body: any;
}

export function formatRequestPayload(
  credentials: ProviderCredentials,
  systemPrompt: string,
  ocrText: string,
  pageImages: string[] = []
): FormattedPayload {
  const { provider, baseUrl, apiKey, modelId } = credentials;
  const userPrompt = `OCR Text reference from document (if any):\n\n${ocrText}`;
  const hasImages = pageImages && pageImages.length > 0;

  switch (provider) {
    case 'openai':
    case 'groq':
    case 'xai': {
      let content: any = `${systemPrompt}\n\n${userPrompt}`;
      
      if (hasImages) {
        content = [
          { type: 'text', text: `${systemPrompt}\n\n${userPrompt}` },
          ...pageImages.map((img) => ({
            type: 'image_url',
            image_url: { url: img }, // img is base64 DataURL: "data:image/jpeg;base64,..."
          })),
        ];
      }

      return {
        url: baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: {
          model: modelId,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'user', content: content },
          ],
          temperature: 0.1,
        },
      };
    }

    case 'anthropic': {
      let content: any = userPrompt;
      
      if (hasImages) {
        content = [
          { type: 'text', text: userPrompt },
          ...pageImages.map((img) => {
            const base64Data = img.split(';base64,').pop() || '';
            const mediaType = img.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            };
          }),
        ];
      }

      return {
        url: baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: {
          model: modelId,
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: content },
          ],
          temperature: 0.1,
        },
      };
    }

    case 'google': {
      const geminiUrl = baseUrl.includes('googleapis.com')
        ? `${baseUrl.replace(/\/$/, '')}/${modelId}:generateContent?key=${apiKey}`
        : `${baseUrl.replace(/\/$/, '')}/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      
      const parts: any[] = [
        { text: `${systemPrompt}\n\n${userPrompt}` }
      ];

      if (hasImages) {
        pageImages.forEach((img) => {
          const base64Data = img.split(';base64,').pop() || '';
          const mediaType = img.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
          parts.push({
            inlineData: {
              mimeType: mediaType,
              data: base64Data
            }
          });
        });
      }
      
      return {
        url: geminiUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          contents: [
            {
              parts: parts
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          }
        },
      };
    }

    case 'custom':
    default: {
      // Local Server (Ollama / LM Studio)
      let content: any = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      if (hasImages) {
        // Many local multimodal models (like Llava or Llama 3.2 Vision) accept image_url in openai format
        content = [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              ...pageImages.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ];
      }

      return {
        url: baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && apiKey !== 'not-needed' ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: {
          model: modelId,
          messages: content,
          temperature: 0.1,
        },
      };
    }
  }
}

export function parseResponsePayload(
  provider: ProviderType,
  responseData: any
): { extractedData: any; confidenceScores: any } {
  let rawText = '';

  try {
    switch (provider) {
      case 'openai':
      case 'groq':
      case 'xai':
      case 'custom':
        rawText = responseData.choices?.[0]?.message?.content || '{}';
        break;

      case 'anthropic':
        rawText = responseData.content?.[0]?.text || '{}';
        break;

      case 'google':
        rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        break;

      default:
        throw new Error('Unsupported provider response parsing');
    }

    let cleanJsonStr = rawText.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.substring(7);
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.substring(3);
    }
    if (cleanJsonStr.endsWith('```')) {
      cleanJsonStr = cleanJsonStr.substring(0, cleanJsonStr.length - 3);
    }
    cleanJsonStr = cleanJsonStr.trim();

    const parsedEnvelope = JSON.parse(cleanJsonStr);
    
    if (parsedEnvelope.extracted_data) {
      return {
        extractedData: parsedEnvelope.extracted_data,
        confidenceScores: parsedEnvelope.confidence_scores || {},
      };
    }

    return {
      extractedData: parsedEnvelope,
      confidenceScores: {},
    };
  } catch (error: any) {
    console.error('Error parsing provider response JSON:', error, 'Raw text:', rawText);
    throw new Error(`Failed to parse extracted JSON from model output: ${error.message}`);
  }
}
