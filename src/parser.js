// Format codes observed in SearchCreatives protobuf response
const FORMAT_MAP = {
  1: 'Display',
  2: 'Search',
  3: 'YouTube',
  4: 'Shopping',
};

function extractDomain(url) {
  try { return new URL(url).hostname; } catch (_) { return null; }
}

function timestampToDate(ts) {
  if (!ts) return null;
  const seconds = parseInt(ts["1"], 10);
  if (isNaN(seconds)) return null;
  const d = new Date(seconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function extractThumbnailUrl(content) {
  if (!content) return null;
  const html = content?.["3"]?.["2"] || '';
  return html.match(/src="([^"]+)"/)?.[1] || null;
}

const GOOGLE_HOST_RE = /google|googleapis|googleusercontent|gstatic|youtube|youtu\.be|googlesyndication/i;

// Try to extract the advertiser's display domain from ad creative HTML.
// Search ad previews often embed the destination URL as an href in the rendered HTML.
function extractDomainFromAdHtml(content) {
  const html = content?.["3"]?.["2"] || '';
  if (!html) return null;
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    try {
      const host = new URL(m[1]).hostname;
      if (!GOOGLE_HOST_RE.test(host)) return host;
    } catch (_) {}
  }
  return null;
}

function parse(raw, enrichments = new Map()) {
  const creatives = raw?.["1"];
  if (!Array.isArray(creatives)) return [];

  return creatives.map((c) => {
    const creativeId = c["2"] || null;
    const homepageUrl = (creativeId && enrichments.get(creativeId)) || null;
    const domain = homepageUrl ? extractDomain(homepageUrl) : (extractDomainFromAdHtml(c["3"]) || null);
    return {
      name: domain || c["12"] || 'Unknown',
      creativeId,
      startDate: timestampToDate(c["6"]),
      endDate: timestampToDate(c["7"]),
      isActive: c["3"]?.["5"] === true,
      formats: [FORMAT_MAP[c["4"]] || `format_${c["4"]}`].filter(Boolean),
      thumbnailUrl: extractThumbnailUrl(c["3"]),
      homepageUrl,
    };
  });
}

function parseCreativeDetail(raw) {
  const creative = raw?.["1"] || {};
  const variants = creative["5"] || [];

  const images = [];
  const previewUrls = [];
  const headlines = [];
  const descriptions = [];
  const keywords = [];
  let homepageUrl = null;

  for (const v of variants) {
    // Display image variant: {"3": {"2": "<img html>"}, "5": active}
    if (v["3"]?.["2"]) {
      const html = v["3"]["2"];
      const src = html.match(/src="([^"]+)"/)?.[1];
      const width = html.match(/width="(\d+)"/)?.[1];
      const height = html.match(/height="(\d+)"/)?.[1];
      if (src && !images.some(i => i.url === src)) {
        images.push({ url: src, width: width ? +width : null, height: height ? +height : null });
      }
    }

    // Preview URL variant: {"1": {"4": url}}
    if (v["1"]?.["4"] && !previewUrls.includes(v["1"]["4"])) {
      previewUrls.push(v["1"]["4"]);
    }

    // Search/RSA text content — field "2" contains text data
    // Structure for search ads (confirmed when tested with search ads advertiser)
    if (v["2"]) {
      const txt = v["2"];
      // Headlines may be in repeated string fields "1"
      const h = txt["1"];
      if (typeof h === 'string') headlines.push(h);
      else if (Array.isArray(h)) headlines.push(...h);
      // Descriptions may be in "2"
      const d = txt["2"];
      if (typeof d === 'string') descriptions.push(d);
      else if (Array.isArray(d)) descriptions.push(...d);
    }

    // Video variant: {"1": {"1": youtube_url}} or similar
    if (v["1"]?.["1"] && typeof v["1"]["1"] === 'string' && v["1"]["1"].includes('youtube')) {
      keywords.push({ type: 'video_url', value: v["1"]["1"] });
    }

    // Scan v["1"] sub-fields for destination URL (finalUrl).
    // Object.keys() iterates integer-like keys ("1","2","3"...) in ascending order per ECMAScript spec,
    // so this scan is deterministic. First non-CDN http URL wins.
    if (!homepageUrl && v["1"] && typeof v["1"] === 'object') {
      for (const key of Object.keys(v["1"])) {
        const val = v["1"][key];
        if (
          typeof val === 'string' &&
          val.startsWith('http') &&
          val.length > 12 &&
          val.includes('.') &&
          !val.includes('googlesyndication') &&
          !val.includes('displayads-formats.googleusercontent') &&
          !val.includes('lh3.googleusercontent') &&
          !val.includes('youtube.com') &&
          !val.includes('youtu.be')
        ) {
          homepageUrl = val;
          break;
        }
      }
    }
  }

  return {
    advertiserId: creative["1"],
    creativeId: creative["2"],
    lastShownDate: timestampToDate(creative["4"]),
    headlines,
    descriptions,
    keywords,
    images,
    previewUrls,
    homepageUrl,
  };
}

module.exports = { parse, parseCreativeDetail };
