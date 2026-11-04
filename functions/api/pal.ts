// Live paper pal, drawn by Muse Image (Meta Model API) holding one of the
// player's room objects. No green-key cut-out needed: it sits on a paper
// card on the share page. Keys stay server-side; the card hides on failure.
// Minimal Cloudflare types, declared here so the repo needs no extra packages.
type PagesFunction<E> = (context: { request: Request; env: E }) => Promise<Response>;

type Env = { MODEL_API_KEY?: string };

const PAPERS: Record<string, string> = {
  lined: "a page of white lined notebook paper with pale blue lines and a pink margin line",
  graph: "pale green graph paper with a fine square grid",
  manuscript: "cream music manuscript paper with staff lines and a few hand-drawn notes",
  blueprint: "a deep blue architectural blueprint with fine white grid and line drawings",
  parchment: "aged golden parchment with soft brown edges",
  map: "a printed map with pastel land, blue rivers and contour lines (no words)",
  watercolour: "thick white watercolour paper with soft splodges of pastel paint",
  lab: "a squared lab notebook page with a faint coffee ring",
  legal: "a yellow legal pad page with thin blue lines and a red margin",
  printout: "old green-and-white striped computer printout paper with tractor-feed holes down the sides",
  kraft: "brown kraft paper with natural fibres",
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function palPrompt(paperDesc: string, object: string): string {
  // Same character and diorama style as pal_prompt() in
  // scripts/build_characters.py, on cream paper instead of a green key.
  return JSON.stringify({
    task: "one original mascot character, full body, isolated, centred, for a cut-out sticker",
    visual_identity: {
      medium: "ultra-detailed paper-cut diorama, like a premium handmade storybook",
      visual_language: ["layered paper depth with subtle shadows", "objects look like tiny paper stickers with a thin white outline", "clean composition", "whimsical but tidy", "fine paper texture"],
      palette: "soft pastels: peach, lavender, powder blue, cream, sage",
      lighting: "soft even studio light, gentle paper shading",
    },
    character: ("a small, cute character made from a scrunched-up ball of " + paperDesc + ": crumpled facets " +
      "and creases all over its round body, a simple happy face drawn in ink on the paper (two curved " +
      "closed-eye smiles or dot eyes, small smile, pink blush), short rolled-paper arms and legs, and a " +
      "single curl of dark ink rising from the top like a little tuft. Friendly, readable at small size. " +
      "The character is proudly holding a tiny paper-cut " + object + "."),
    composition: "front view, whole character in frame with a wide margin, standing upright",
    background: "flat plain warm cream paper #F3EDE4 with a faint paper grain, nothing else, soft ground shadow",
    negative: ["plastic or glossy CGI rendering", "oversaturated or neon colours", "text", "letters", "words", "logos", "watermark", "border", "frame", "realistic human", "shadow on the background"],
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.MODEL_API_KEY) return jsonError("model key not configured", 503);

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return jsonError("invalid json", 400);
    data = parsed as Record<string, unknown>;
  } catch {
    return jsonError("invalid json", 400);
  }

  const paper = typeof data.paper === "string" ? data.paper : "";
  if (!(paper in PAPERS)) return jsonError("invalid paper", 400);
  const object = (typeof data.object === "string" ? data.object : "")
    .replace(/[^A-Za-z0-9 ,-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!object) return jsonError("invalid object", 400);

  let res: Response;
  try {
    res = await fetch("https://api.meta.ai/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.MODEL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "muse-image-1.0", n: 1, size: "1024x1024", output_format: "png",
        tool_enablement: { enable_image_search: false, enable_web_search: false },
        prompt: palPrompt(PAPERS[paper], object),
      }),
    });
  } catch {
    return jsonError("image model unavailable", 502);
  }
  if (!res.ok) return jsonError("image model failed", 502);
  let out: { data?: { b64_json?: string }[] };
  try {
    out = (await res.json()) as { data?: { b64_json?: string }[] };
  } catch {
    return jsonError("image model failed", 502);
  }
  const png = out.data?.[0]?.b64_json;
  if (!png) return jsonError("image model failed", 502);

  return new Response(JSON.stringify({ png, paper, model: "muse-image-1.0 (Meta Model API)" }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
