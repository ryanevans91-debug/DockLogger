// Gemini API utility for parsing timesheets and paystubs

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Get API key from environment variable (fallback)
const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Helper to get the API key (user's key takes priority, then env)
export function getGeminiApiKey(userKey?: string | null): string {
  return userKey || ENV_API_KEY;
}

export interface ParsedTimesheetEntry {
  date: string;
  shift_type: 'day' | 'afternoon' | 'graveyard';
  hours: number;
  job_name: string;
  earnings?: number;
  location?: string;
  ship?: string;
}

export interface ParsedPaystubData {
  gross_pay?: number;
  net_pay?: number;
  federal_tax?: number;
  provincial_tax?: number;
  cpp?: number;
  ei?: number;
  union_dues?: number;
  pension_contribution?: number;
  other_deductions?: number;
  pay_period_start?: string;
  pay_period_end?: string;
  hours_worked?: number;
}

export interface GeminiResponse {
  success: boolean;
  data?: ParsedTimesheetEntry[] | ParsedPaystubData;
  error?: string;
}

async function callGemini(apiKey: string, prompt: string, imageBase64?: string): Promise<string> {
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

  if (imageBase64) {
    // Extract mime type and data from base64 string
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
      parts.push({
        inline_data: {
          mime_type: matches[1],
          data: matches[2]
        }
      });
    }
  }

  parts.push({ text: prompt });

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API request failed');
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function parseTimesheetWithGemini(
  apiKey: string,
  content: string | null,
  imageBase64?: string
): Promise<GeminiResponse> {
  const prompt = `You are a timesheet data extractor. Analyze the provided timesheet data (image or text) and extract work entries.

For each entry, extract:
- date: The work date in YYYY-MM-DD format
- shift_type: Classify as "day" (morning shifts, typically 8am-4:30pm), "afternoon" (evening shifts, typically 4:30pm-1am), or "graveyard" (night shifts, typically 1am-8am)
- hours: Number of hours worked (decimal, e.g., 8 or 6.5)
- job_name: The job title, position, or work description
- earnings: Total earnings for that shift if shown (number only, no currency symbols)
- location: Work location if mentioned
- ship: Ship name if mentioned (this is for longshoremen/dock workers)

Return ONLY a valid JSON array of objects. No markdown, no explanation, just the JSON array.
Example format:
[{"date":"2024-01-15","shift_type":"day","hours":8,"job_name":"Crane Operator","earnings":450.00,"location":"Deltaport","ship":"MSC Oscar"}]

If no valid timesheet data is found, return an empty array: []

${content ? `\nText content to parse:\n${content}` : ''}`;

  try {
    const response = await callGemini(apiKey, prompt, imageBase64);

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const entries = JSON.parse(jsonStr) as ParsedTimesheetEntry[];

    // Validate and normalize entries
    const validEntries = entries
      .filter(e => e.date && e.hours)
      .map(e => ({
        ...e,
        date: normalizeDate(e.date),
        shift_type: normalizeShiftType(e.shift_type),
        hours: Number(e.hours) || 8,
        job_name: e.job_name || 'Imported',
        earnings: e.earnings ? Number(e.earnings) : undefined
      }));

    return { success: true, data: validEntries };
  } catch (error) {
    console.error('Gemini parsing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse timesheet'
    };
  }
}

export async function parsePaystubWithGemini(
  apiKey: string,
  imageBase64: string
): Promise<GeminiResponse> {
  const prompt = `You are a paystub data extractor for Canadian longshoremen. Analyze this paystub image and extract financial information.

Extract these fields (use null if not found):
- gross_pay: Total gross earnings (number)
- net_pay: Take-home pay after deductions (number)
- federal_tax: Federal income tax deducted (number)
- provincial_tax: Provincial income tax deducted (number)
- cpp: Canada Pension Plan contribution (number)
- ei: Employment Insurance premium (number)
- union_dues: Union dues deducted (number)
- pension_contribution: Pension plan contribution (number)
- other_deductions: Sum of any other deductions (number)
- pay_period_start: Start date of pay period (YYYY-MM-DD)
- pay_period_end: End date of pay period (YYYY-MM-DD)
- hours_worked: Total hours worked in this period (number)

Return ONLY a valid JSON object. No markdown, no explanation, just the JSON object.
Example:
{"gross_pay":2500.00,"net_pay":1850.00,"federal_tax":320.00,"provincial_tax":180.00,"cpp":95.00,"ei":45.00,"union_dues":50.00,"pension_contribution":null,"other_deductions":10.00,"pay_period_start":"2024-01-01","pay_period_end":"2024-01-15","hours_worked":80}`;

  try {
    const response = await callGemini(apiKey, prompt, imageBase64);

    // Extract JSON from response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const data = JSON.parse(jsonStr) as ParsedPaystubData;

    return { success: true, data };
  } catch (error) {
    console.error('Gemini paystub parsing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse paystub'
    };
  }
}

function normalizeDate(dateStr: string): string {
  // Try to parse various date formats and return YYYY-MM-DD
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return dateStr;
}

function normalizeShiftType(shift: string): 'day' | 'afternoon' | 'graveyard' {
  const s = (shift || '').toLowerCase();
  if (s.includes('grave') || s.includes('night') || s.includes('mid')) {
    return 'graveyard';
  }
  if (s.includes('after') || s.includes('evening') || s.includes('pm') || s.includes('swing')) {
    return 'afternoon';
  }
  return 'day';
}

export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  try {
    await callGemini(apiKey, 'Reply with just the word "OK"');
    return true;
  } catch {
    return false;
  }
}
