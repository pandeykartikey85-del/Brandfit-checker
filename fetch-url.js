// ============================================
// Vercel Serverless Function: /api/fetch-url
// Safely retrieves publicly accessible webpage content
// Strips HTML/scripts and normalizes text for AI analysis.
// Never invents data if the page cannot be read.
// ============================================

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Only POST requests are supported.' });
  }

  const { url, mode } = req.body || {};

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid webpage URL.'
    });
  }

  let parsedUrl;
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    parsedUrl = new URL(cleanUrl);
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: 'Invalid URL format. Please provide a full webpage URL.'
    });
  }

  const isBrandMode = mode === 'brand' ||
    parsedUrl.hostname.includes('instagram.com') ||
    parsedUrl.hostname.includes('tiktok.com') ||
    parsedUrl.hostname.includes('youtube.com');

  const INSUFFICIENT_MSG = isBrandMode
    ? "We couldn't retrieve sufficient public profile information. Upload a screenshot, media kit, or analytics report."
    : "We couldn't retrieve enough information from this page. Upload a screenshot or paste the relevant text for a deeper analysis.";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s timeout

    const fetchResponse = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BrandFitChecker/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!fetchResponse.ok) {
      console.warn(`[/api/fetch-url] HTTP ${fetchResponse.status} for ${parsedUrl.hostname}`);
      return res.status(200).json({
        success: false,
        message: INSUFFICIENT_MSG
      });
    }

    const contentType = fetchResponse.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return res.status(200).json({
        success: false,
        message: INSUFFICIENT_MSG
      });
    }

    const html = await fetchResponse.text();
    const extracted = cleanHtmlContent(html, parsedUrl.hostname);

    if (!extracted || extracted.wordCount < 25) {
      return res.status(200).json({
        success: false,
        message: INSUFFICIENT_MSG
      });
    }

    return res.status(200).json({
      success: true,
      url: parsedUrl.toString(),
      domain: parsedUrl.hostname,
      title: extracted.title,
      text: extracted.text
    });

  } catch (err) {
    console.warn(`[/api/fetch-url] Fetch failed for ${parsedUrl?.hostname}:`, err.message);
    return res.status(200).json({
      success: false,
      message: INSUFFICIENT_MSG
    });
  }
}

function cleanHtmlContent(html, hostname) {
  if (!html) return null;

  // 1. Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : '';

  // 2. Extract meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i) ||
                        html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

  // 3. Remove non-content tags: script, style, noscript, svg, header, nav, footer, iframe
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');

  // 4. Strip all HTML tags
  clean = clean.replace(/<[^>]+>/g, ' ');

  // 5. Decode HTML entities
  clean = clean
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // 6. Normalize multiple spaces & newlines
  const textBody = clean.replace(/\s+/g, ' ').trim();
  const wordCount = textBody.split(/\s+/).filter(w => w.length > 0).length;

  // Build structured summary
  const summaryParts = [];
  summaryParts.push(`SOURCE URL: https://${hostname}`);
  if (pageTitle) summaryParts.push(`PAGE TITLE: ${pageTitle}`);
  if (metaDescription) summaryParts.push(`PAGE DESCRIPTION: ${metaDescription}`);
  summaryParts.push(`PAGE CONTENT SUMMARY:\n${textBody.slice(0, 3500)}`);

  return {
    title: pageTitle,
    text: summaryParts.join('\n\n'),
    wordCount
  };
}
