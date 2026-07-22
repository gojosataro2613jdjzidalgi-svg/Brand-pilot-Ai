// api/generate.js
// Vercel Serverless Function
// Generates marketing content using Google Gemini 2.5 Flash

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function isRtlLanguage(language = "") {
  const rtlLangs = ["arabic", "ar", "hebrew", "he", "urdu", "ur", "farsi", "persian", "fa"];
  return rtlLangs.includes(language.trim().toLowerCase());
}


// Platform-specific writing instructions injected into the prompt so the
// generated content is optimized for how each platform is actually consumed.
const PLATFORM_INSTRUCTIONS = {
  general: "General: Write balanced, versatile marketing copy that is not tied to any single platform's format or conventions.",
  instagram: "Instagram: Write an engaging, visually descriptive caption. Use a warm, scroll-stopping hook, tasteful emojis, and end the social post with a strong set of relevant hashtags.",
  facebook: "Facebook: Write warm, community-focused content that encourages comments, shares, and conversation. Favor a conversational, relatable tone over a hard sell.",
  tiktok: "TikTok: Write short, high-energy, trend-aware content with a scroll-stopping hook in the first line. Keep sentences punchy and casual, suited for a short-form video caption.",
  linkedin: "LinkedIn: Write polished, professional, business-oriented content. Focus on credibility, insight, and value for a professional audience. Avoid slang and excessive emojis.",
  x: "X (Twitter): Write concise, punchy, tweet-style content. Keep the social post short and impactful, suitable for a single tweet, with sharp wording and minimal filler.",
  youtube: "YouTube: Write content suited for a video title and description. Emphasize curiosity, clarity, and audience retention, and encourage viewers to watch, like, and subscribe."
};

function getPlatformInstruction(platform) {
  const key = (platform || "general").trim().toLowerCase();
  return PLATFORM_INSTRUCTIONS[key] || PLATFORM_INSTRUCTIONS.general;
}

function buildPrompt({ brandName, productType, targetAudience, productDescription, language, goal, tone, contentType, platform, hasImage }) {

// Extra product context, appended to every prompt variant below (including
// the brand_name early-return) so both text-only and image-assisted
// requests share the same enrichment logic.
const descriptionLine = productDescription
  ? `Product Description: ${productDescription}`
  : `Product Description: Not provided.`;

const imageInstruction = hasImage
  ? `\nProduct Image: A real photo of the actual product has been attached to this request. Carefully examine its packaging, colors, materials, shape, style, and mood, and weave specific, authentic visual details from the photo into the copy so it reads as if it were written by someone who has genuinely seen and handled the product.\n`
  : "";

let task = "";

switch (contentType) {
  case "advertisement":
    task = "Write a persuasive advertisement.";
    break;

  case "product_description":
    task = "Write a professional product description.";
    break;

  case "social_post":
    task = "Write a viral social media post.";
    break;

  case "brand_name":
    return `
You are a world-class branding expert.

Generate 10 unique and memorable brand names.

Language: ${language}
Marketing Goal: ${goal}
Tone of Voice: ${tone}
Product Type: ${productType}
Target Platform: ${platform || "general"}
${descriptionLine}
${imageInstruction}
Target Audience: ${targetAudience}

Return ONLY valid JSON in this format:

{
  "tagline": "Name 1, Name 2, Name 3, Name 4, Name 5, Name 6, Name 7, Name 8, Name 9, Name 10",
  "description": "A short explanation of why these names fit the brand.",
  "social": "Recommend the best brand name and explain why.",
  "hashtags": ["#Brand", "#Startup", "#Business", "#Marketing"]
}
`;

  case "slogan":
    task = "Suggest 10 catchy slogans.";
    break;

  case "marketing_email":
    task = "Write a marketing email.";
    break;

  case "video_script":
    task = "Write a short promotional video script.";
    break;

  default:
    task = "Generate marketing content.";
}

return `
You are BrandPilot AI, an elite marketing intelligence system trusted by global brands.

You think like a team of world-class experts, including:
- Brand Strategist
- Copywriting Expert
- Consumer Psychology Expert
- Digital Marketing Expert
- SEO Specialist
- Social Media Strategist
- Creative Director

Your mission is to create marketing content that is persuasive, original, strategic, and ready for real-world use.

Before writing:
1. Analyze the product or service.
2. Analyze the target audience.
3. Analyze the marketing goal.
4. Choose the most effective marketing strategy.
5. Create content optimized for engagement, trust, and conversions.
${hasImage ? "6. Study the attached product image closely and let its real visual details inform your word choices." : ""}

Rules:
- Never generate generic or repetitive content.
- Make every response unique and memorable.
- Adapt the tone to the audience and the requested content type.
- Use strong emotional triggers naturally.
- Write like a senior marketing professional.
- Maximize clarity, creativity, and conversion potential.
- Always deliver premium-quality marketing content.

Tone of Voice Instructions:
- Professional: Formal, credible, and business-oriented.
- Friendly: Warm, approachable, and conversational.
- Luxury: Elegant, premium, and sophisticated.
- Persuasive: Highly convincing with strong calls to action.
- Gen Z: Trendy, energetic, and modern.
- Minimal: Clear, concise, and simple.
- Funny: Light-hearted, humorous, and engaging.

Always strictly follow the selected Tone of Voice.

Platform Optimization Instructions:
${getPlatformInstruction(platform)}

Always optimize the "social" field (and the overall content style) specifically for the selected platform above, while keeping the tagline, description, and hashtags consistent with it.

${task}

Language: ${language}

Marketing Goal: ${goal}

Tone of Voice: ${tone}

Target Platform: ${platform || "general"}

Brand Name: ${brandName}

Product Type: ${productType}

${descriptionLine}
${imageInstruction}
Target Audience: ${targetAudience}

IMPORTANT:
Return ONLY valid JSON.
Do not write any text before the JSON.
Do not write any text after the JSON.
Do not use Markdown.
Do not wrap the JSON inside \`\`\`json.
The response must be directly parseable as valid JSON.

{
  "tagline":"",
  "description":"",
  "social":"",
  "hashtags":[]
}
`;
}
function extractJson(text) {
  if (!text) return null;

  // Strip markdown code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/i, "");
  cleaned = cleaned.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fall back to extracting the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Retry configuration for the Gemini API request.
//
// Gemini occasionally returns HTTP 503 (UNAVAILABLE) when the model is
// temporarily overloaded. This is a transient error, so it's safe to retry
// the exact same request a few times before giving up.
//
// Behavior:
// - Only retries on HTTP 503. Any other status (400, 401, 429, 500, etc.)
//   is returned immediately without retrying, since retrying those would
//   not help (or could make things worse, e.g. for rate limits).
// - Retries up to MAX_RETRIES times (3 retries = up to 4 total attempts).
// - Waits RETRY_DELAY_MS (2000ms) between attempts.
// ---------------------------------------------------------------------------
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calls the Gemini API and automatically retries on HTTP 503 (UNAVAILABLE).
// `fetchOptions` are passed through untouched to `fetch`.
// Returns the same Response object that `fetch` would return, whether it
// succeeded or ultimately failed after all retries.
async function fetchGeminiWithRetry(url, fetchOptions) {
  let lastResponse;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, fetchOptions);

    // Success or a non-503 error: return immediately, no retry needed.
    if (response.status !== 503) {
      return response;
    }

    lastResponse = response;

    // If we still have retries left, wait and try again.
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  // All attempts (including retries) resulted in 503; return the last response.
  return lastResponse;
}

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server misconfiguration: missing GEMINI_API_KEY." });
    }

    // Parse body (Vercel usually parses JSON automatically, but handle raw string too)
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: "Invalid JSON in request body." });
      }
    }

    const { brandName, productType, targetAudience, productDescription, language, goal, tone, contentType, platform, productImage } = body || {};

    if (!brandName || !productType || !targetAudience || !language) {
      return res.status(400).json({
        error: "Missing required fields: brandName, productType, targetAudience, language are all required."
      });
    }

    // --------------------------------------------------------------------
    // Product image validation (defense in depth — the client already
    // validates type/size before sending, but the server never trusts a
    // client-supplied payload). Expected shape: { data: base64String,
    // mimeType: "image/jpeg" | "image/png" | "image/webp" }.
    // --------------------------------------------------------------------
    const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
    // 8MB decoded, converted to an approximate base64-character ceiling
    // (base64 inflates size by ~4/3), plus a small buffer for padding.
    const MAX_IMAGE_BASE64_LENGTH = Math.ceil((8 * 1024 * 1024 * 4) / 3) + 1024;

    let sanitizedImage = null;
    if (productImage && typeof productImage === "object") {
      const { data: imgData, mimeType } = productImage;
      const looksValid = typeof imgData === "string" && imgData.length > 0 && ALLOWED_IMAGE_MIME_TYPES.includes(mimeType);

      if (looksValid && imgData.length <= MAX_IMAGE_BASE64_LENGTH) {
        sanitizedImage = { data: imgData, mimeType };
      } else if (looksValid) {
        return res.status(400).json({ error: "Uploaded image is too large. Maximum size is 8MB." });
      } else {
        return res.status(400).json({ error: "Invalid product image. Use JPG, PNG, or WEBP." });
      }
    }

    // Keep free-form description input to a sane length before it reaches the prompt.
    const safeDescription = typeof productDescription === "string" ? productDescription.trim().slice(0, 800) : "";

    const prompt = buildPrompt({
  brandName,
  productType,
  targetAudience,
  productDescription: safeDescription,
  language,
  goal,
  tone,
  contentType,
  platform,
  hasImage: !!sanitizedImage
});

    // The text prompt always comes first; the product photo (if any) is
    // attached as a second part so Gemini reasons about them together as a
    // single multimodal request rather than as two separate calls.
    const parts = [{ text: prompt }];
    if (sanitizedImage) {
      parts.push({
        inlineData: {
          mimeType: sanitizedImage.mimeType,
          data: sanitizedImage.data
        }
      });
    }

    // Uses fetchGeminiWithRetry instead of a plain fetch() so that transient
    // 503 (UNAVAILABLE) errors from Gemini are retried automatically.
    const geminiResponse = await fetchGeminiWithRetry(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts
          }
        ],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return res.status(502).json({
        error: "Gemini API request failed.",
        details: errText
      });
    }

    const data = await geminiResponse.json();

    const candidateText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

    const parsed = extractJson(candidateText);

    if (!parsed) {
      return res.status(502).json({
        error: "Failed to parse content generated by Gemini.",
        raw: candidateText
      });
    }

    const dir = isRtlLanguage(language) ? "rtl" : "ltr";

    const result = {
      dir,
      tagline: typeof parsed.tagline === "string" ? parsed.tagline : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      social: typeof parsed.social === "string" ? parsed.social : "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h) => typeof h === "string") : []
    };

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected server error.",
      details: error?.message || String(error)
    });
  }
};
