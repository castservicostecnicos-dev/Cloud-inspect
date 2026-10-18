/**
 * Helper to extract dates from free text description and evaluate maintenance alerts
 */

export interface DateAlertEvaluation {
  rawDetectedText: string | null;
  isoDate: string | null; // YYYY-MM-DD
  formattedDate: string | null; // DD/MM/YYYY
  daysRemaining: number | null; // negative if expired, 0..30 if expiring soon
  isExpired: boolean;
  isExpiringSoon: boolean; // 0 <= days <= 30
  isAlertTriggered: boolean; // isExpired || isExpiringSoon
  alertBadgeText: string | null;
}

/**
 * Extracts a date from a text string.
 * Supports:
 * - DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
 * - YYYY-MM-DD or YYYY/MM/DD
 * - DD/MM/YY
 */
export function extractDateFromText(text?: string | null): { raw: string; iso: string } | null {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();

  // Pattern 1: Brazilian DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const brMatch = trimmed.match(/\b([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.]((?:20|19)\d{2})\b/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10);
    const year = parseInt(brMatch[3], 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { raw: brMatch[0], iso };
    }
  }

  // Pattern 2: ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/\b((?:20|19)\d{2})[\/\-\.]([0-1]?[0-9])[\/\-\.]([0-3]?[0-9])\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { raw: isoMatch[0], iso };
    }
  }

  // Pattern 3: Short year DD/MM/YY
  const shortYearMatch = trimmed.match(/\b([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.](\d{2})\b/);
  if (shortYearMatch) {
    const day = parseInt(shortYearMatch[1], 10);
    const month = parseInt(shortYearMatch[2], 10);
    const year = 2000 + parseInt(shortYearMatch[3], 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { raw: shortYearMatch[0], iso };
    }
  }

  return null;
}

/**
 * Evaluates whether a date (from text or explicit alertDate) triggers an alert.
 * An alert triggers if it is <= 30 days until due OR already expired.
 */
export function evaluateDateAlert(
  descriptionText?: string | null,
  explicitDate?: string | null,
  alertEnabled: boolean = false
): DateAlertEvaluation {
  // If user provided explicit date or we extract it from description
  let isoDate: string | null = null;
  let rawDetectedText: string | null = null;

  if (explicitDate && explicitDate.trim()) {
    const expClean = explicitDate.trim();
    const extracted = extractDateFromText(expClean);
    if (extracted) {
      isoDate = extracted.iso;
      rawDetectedText = extracted.raw;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(expClean)) {
      isoDate = expClean;
      rawDetectedText = expClean;
    }
  }

  if (!isoDate && descriptionText) {
    const extracted = extractDateFromText(descriptionText);
    if (extracted) {
      isoDate = extracted.iso;
      rawDetectedText = extracted.raw;
    }
  }

  if (!isoDate) {
    return {
      rawDetectedText: null,
      isoDate: null,
      formattedDate: null,
      daysRemaining: null,
      isExpired: false,
      isExpiringSoon: false,
      isAlertTriggered: false,
      alertBadgeText: null,
    };
  }

  const [y, m, d] = isoDate.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d, 23, 59, 59);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const diffMs = targetDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const isExpired = daysRemaining < 0;
  const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 30;
  const isAlertTriggered = alertEnabled && (isExpired || isExpiringSoon);

  const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

  let alertBadgeText: string | null = null;
  if (isExpired) {
    const absDays = Math.abs(daysRemaining);
    alertBadgeText = `VENCIDO há ${absDays} ${absDays === 1 ? 'dia' : 'dias'} (${formattedDate})`;
  } else if (daysRemaining === 0) {
    alertBadgeText = `VENCE HOJE (${formattedDate})`;
  } else if (isExpiringSoon) {
    alertBadgeText = `Vence em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} (${formattedDate})`;
  } else {
    alertBadgeText = `Em dia (${daysRemaining} dias até ${formattedDate})`;
  }

  return {
    rawDetectedText,
    isoDate,
    formattedDate,
    daysRemaining,
    isExpired,
    isExpiringSoon,
    isAlertTriggered,
    alertBadgeText,
  };
}
