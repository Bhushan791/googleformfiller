/**
 * Returns true if `url` is a valid Google Forms link.
 * Accepted patterns:
 *   • https://docs.google.com/forms/d/...
 *   • https://docs.google.com/forms/d/e/.../viewform
 *   • https://forms.gle/...
 */
export function isValidGoogleFormUrl(url) {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);

    // docs.google.com/forms/d/...
    if (
      parsed.hostname === 'docs.google.com' &&
      /^\/forms\/d(\/|$)/.test(parsed.pathname)
    ) {
      return true;
    }

    // forms.gle/SHORTCODE
    if (
      parsed.hostname === 'forms.gle' &&
      parsed.pathname.length > 1 // must have something after /
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

