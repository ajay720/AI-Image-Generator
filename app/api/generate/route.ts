import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Replicate from "replicate";

export const runtime = "nodejs";

const styleTriggers: Record<string, string> = {
  anime: "anime style, Studio Ghibli, cel-shaded",
  "oil-painting": "oil on canvas, thick brushstrokes, painterly",
  cinematic: "cinematic photography, 35mm film, anamorphic lens, bokeh",
  "neon-glow": "neon lights, cyberpunk city, glowing, dark atmosphere",
};

type GenerateRequest = {
  prompt: string;
  negativePrompt?: string;
  style?: string;
  model?: string;
};

type ImageResult = {
  url: string;
  base64: string;
};

function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(id));
}

async function generateFreeImage(
  prompt: string,
  style?: string
): Promise<ImageResult[]> {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 100000);

  let styleParam = "";
  if (style === "anime") styleParam = "&style=anime";
  else if (style === "oil-painting") styleParam = "&style=oil-painting";
  else if (style === "cinematic") styleParam = "&style=cinematic";
  else if (style === "neon-glow") styleParam = "&style=neon-glow";

  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}${styleParam}&guidance=${style ? 7.5 : 5
    }`;

  // 🔹 Try Pollinations
  try {
    const response = await fetchWithTimeout(pollinationsUrl, {}, 30000);

    if (response.status === 429) {
      throw new Error("Service busy");
    }

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.includes("image")) {
      const text = await response.text().catch(() => "");
      console.error("Pollinations error:", response.status, text);
      throw new Error("Pollinations failed");
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = `data:${contentType};base64,${buffer.toString("base64")}`;

    return [{ url: pollinationsUrl, base64 }];
  } catch (err: unknown) {
    console.error("Pollinations failed:", err);
  }

  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfApiKey) {
    throw new Error("No HuggingFace API key configured");
  }

  const models = [
    "stabilityai/stable-diffusion-2-1",
    "runwayml/stable-diffusion-v1-5",
    "CompVis/stable-diffusion-v1-4",
  ];

  let lastError: unknown = null;

  for (const model of models) {
    try {
      const hfResponse = await fetchWithTimeout(
        `https://router.huggingface.co/hf-inference/models/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: prompt }),
        },
        120000
      );

      if (!hfResponse.ok) {
        const errorText = await hfResponse.text().catch(() => "");
        console.error(`Model ${model} failed:`, errorText);
        lastError = errorText;
        continue;
      }

      const blob = await hfResponse.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      const base64 = `data:image/png;base64,${buffer.toString("base64")}`;

      return [{ url: base64, base64 }];
    } catch (err: unknown) {
      console.error(`Model ${model} error:`, err);
      lastError = err;
    }
  }

  const replicateApiToken = process.env.REPLICATE_API_TOKEN;
  if (replicateApiToken) {
    try {
      const replicate = new Replicate({ auth: replicateApiToken });
      const output = await replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        {
          input: {
            prompt: prompt,
            width: 1024,
            height: 1024,
          },
        }
      );
      // Assuming output is an array of URLs
      const imageUrls = Array.isArray(output) ? output : [output];
      return imageUrls.map((url: string) => ({ url, base64: url }));
    } catch (replicateError: unknown) {
      console.error("Replicate error:", replicateError);
      const message = replicateError instanceof Error ? replicateError.message : JSON.stringify(replicateError);
      throw new Error(`Image generation failed: ${message}`);
    }
  }

  throw new Error(
    `All models failed: ${lastError instanceof Error
      ? lastError.message
      : typeof lastError === "string"
        ? lastError
        : JSON.stringify(lastError)
    }`
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { prompt, negativePrompt, style, model = "free" } = body;

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Please log in first" },
        { status: 401 }
      );
    }

    const fullPrompt = style
      ? `${prompt}, ${styleTriggers[style] || ""}`
      : prompt;

    const images = await generateFreeImage(fullPrompt, style);
    const imageUrls = images.map((img) => img.url);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const token = authHeader.replace("Bearer ", "");

        const {
          data: { user },
        } = await supabase.auth.getUser(token);

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
      }
    } catch (dbError: unknown) {
      console.log("DB error (ignored):", dbError);
    }

    return NextResponse.json({
      generation: {
        image_urls: imageUrls,
        prompt: fullPrompt,
      },
    });
  } catch (error: unknown) {
    console.error("GENERATION ERROR:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";

    const status = message.toLowerCase().includes("insufficient credit") ? 402 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}