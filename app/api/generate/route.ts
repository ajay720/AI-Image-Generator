import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";

const styleTriggers: Record<string, string> = {
  anime: "anime style, Studio Ghibli, cel-shaded",
  "oil-painting": "oil on canvas, thick brushstrokes, painterly",
  cinematic: "cinematic photography, 35mm film, anamorphic lens, bokeh",
  "neon-glow": "neon lights, cyberpunk city, glowing, dark atmosphere",
};

// Free image generation from Pollinations
async function generateFreeImage(prompt: string, style?: string): Promise<{url: string, base64: string}[]> {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 100000);
  
  // Add style parameter based on selection
  let styleParam = '';
  if (style === 'anime') styleParam = '&style=anime';
  else if (style === 'oil-painting') styleParam = '&style=oil-painting';
  else if (style === 'cinematic') styleParam = '&style=cinematic';
  else if (style === 'neon-glow') styleParam = '&style=neon';
  
  // Use pollinations with more specific parameters
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}${styleParam}&guidance=${style ? 7.5 : 5}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Generation failed: ${response.status}`);
  }
  
  return [{ url, base64: url }];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, negativePrompt, style, model = "free" } = body;

    const authHeader = request.headers.get("authorization");
    if (!authHeader || authHeader === 'Bearer null' || authHeader === 'Bearer undefined') {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }

    const fullPrompt = style
      ? `${prompt}, ${styleTriggers[style] || ""}`
      : prompt;

    // Generate free image
    const images = await generateFreeImage(fullPrompt, style);
    const imageUrls = images.map(img => img.url);

    // Try to save to DB (optional)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        await supabase.from("generations").insert({
          user_id: user.id,
          prompt: fullPrompt,
          negative_prompt: negativePrompt,
          style,
          model,
          image_urls: imageUrls,
        });
      }
    } catch (dbError) {
      console.log('DB error (continuing anyway):', dbError);
    }

    return NextResponse.json({ generation: { image_urls: imageUrls, prompt: fullPrompt } });
  } catch (error: unknown) {
    console.error("GENERATION ERROR:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}