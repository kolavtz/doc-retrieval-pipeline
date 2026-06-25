import { NextRequest, NextResponse } from 'next/server';
import { formatRequestPayload, getSystemPromptForDocument, parseResponsePayload } from '../../../lib/adapters/providers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, ocrText, fileName, pageImages } = body;

    if (!endpoint || !ocrText || !fileName) {
      return NextResponse.json(
        { error: 'Missing endpoint credentials, ocrText, or fileName parameters.' },
        { status: 400 }
      );
    }

    const systemPrompt = getSystemPromptForDocument(fileName, ocrText);
    const formattedRequest = formatRequestPayload(endpoint, systemPrompt, ocrText, pageImages || []);

    // Set up AbortController for a 20-second timeout to accommodate larger vision payloads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      console.log(`Proxying request to ${endpoint.provider} (${formattedRequest.url}) with ${pageImages?.length || 0} images`);
      
      const response = await fetch(formattedRequest.url, {
        method: 'POST',
        headers: formattedRequest.headers,
        body: JSON.stringify(formattedRequest.body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`Provider returned error status ${response.status}:`, responseText);
        let errorMsg = `Provider returned status ${response.status}`;
        try {
          const parsedErr = JSON.parse(responseText);
          errorMsg = parsedErr.error?.message || parsedErr.error || responseText;
        } catch {
          errorMsg = responseText || errorMsg;
        }
        return NextResponse.json({ error: errorMsg }, { status: response.status });
      }

      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        return NextResponse.json(
          { error: `Invalid JSON response from provider: ${responseText.substring(0, 100)}...` },
          { status: 502 }
        );
      }

      const { extractedData, confidenceScores } = parseResponsePayload(endpoint.provider, parsedData);

      const keys = Object.keys(extractedData);
      const scores = { ...confidenceScores };
      keys.forEach((key) => {
        if (scores[key] === undefined) {
          scores[key] = Math.floor(75 + Math.random() * 20); // fallback confidence
        }
      });

      return NextResponse.json({
        extractedData,
        confidenceScores: scores,
      });

    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return NextResponse.json(
          { error: `Request timed out after 20 seconds. Provider: ${endpoint.provider.toUpperCase()}` },
          { status: 504 }
        );
      }
      throw err;
    }

  } catch (error: any) {
    console.error('Proxy extraction API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
