import { SyncSummary } from '../types';

export async function pushXmlToTally(
  tallyHost: string,
  xmlPayload: string
): Promise<{ success: boolean; summary: SyncSummary; errorDetail?: string }> {
  try {
    const response = await fetch(tallyHost, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: xmlPayload,
    });

    if (!response.ok) {
      return {
        success: false,
        summary: {
          created: 0,
          altered: 0,
          deleted: 0,
          combined: 0,
          ignored: 0,
          errors: 1,
          exceptions: 0,
        },
        errorDetail: `Tally server responded with HTTP status ${response.status}: ${response.statusText}`,
      };
    }

    const responseText = await response.text();
    const summary = parseTallyResponse(responseText);

    const isSuccess = summary.created > 0 && summary.errors === 0 && summary.exceptions === 0;

    return {
      success: isSuccess,
      summary,
    };
  } catch (err: any) {
    const isCorsOrNetwork =
      err?.name === 'TypeError' ||
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError');

    const errorMsg = isCorsOrNetwork
      ? `Tally Prime se direct connection fail hua (${tallyHost}). 
Kripya check karein:
1. Tally Prime chal raha hai aur Company open hai.
2. F1 > Settings > Connectivity > Client/Server configuration mein HTTP Server Enabled hai aur Port 9000 hai.
3. Browser Security (CORS/Private Network) block kar raha hai: XML File download karein aur Tally mein Alt+O > Transactions se direct import karein!`
      : err?.message || 'Unknown network error';

    return {
      success: false,
      summary: {
        created: 0,
        altered: 0,
        deleted: 0,
        combined: 0,
        ignored: 0,
        errors: 1,
        exceptions: 0,
      },
      errorDetail: errorMsg,
    };
  }
}

export function parseTallyResponse(xml: string): SyncSummary {
  const getTagValue = (tag: string): number => {
    const match = xml.match(new RegExp(`<${tag}>(\\d+)</${tag}>`, 'i'));
    return match ? parseInt(match[1], 10) : 0;
  };

  const created = getTagValue('CREATED');
  const altered = getTagValue('ALTERED');
  const deleted = getTagValue('DELETED');
  const combined = getTagValue('COMBINED');
  const ignored = getTagValue('IGNORED');
  const errors = getTagValue('ERRORS');
  const exceptions = getTagValue('EXCEPTIONS');

  let logMessage = '';
  // Check for line errors
  const lineErrors = xml.match(/<LINEERROR>(.*?)<\/LINEERROR>/gi);
  if (lineErrors) {
    logMessage = lineErrors.map((e) => e.replace(/<\/?LINEERROR>/gi, '')).join('\n');
  }

  return {
    created,
    altered,
    deleted,
    combined,
    ignored,
    errors,
    exceptions,
    rawResponse: xml,
    logMessage,
  };
}
