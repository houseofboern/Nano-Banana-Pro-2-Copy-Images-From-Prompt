
import { GoogleGenAI, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Character } from "../types";

// Helper to extract clean error message from various error shapes
const getErrorMessage = (error: any): string => {
  if (error instanceof Error) return error.message;
  // Handle Google API error objects which often look like { error: { code: 500, message: "..." } }
  if (typeof error === 'object' && error !== null) {
      const e = error as any;
      if (e.error?.message) return e.error.message;
      if (e.message) return e.message;
  }
  return JSON.stringify(error);
};

// Timeout helper to prevent silent failures hanging forever
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
};

// Retry helper with exponential backoff
const withRetry = async <T>(
  fn: () => Promise<T>, 
  retries: number = 1, 
  delayMs: number = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    const msg = getErrorMessage(error);
    console.warn(`Operation failed, retrying... (${retries} attempts left). Error: ${msg}`);
    
    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    // Retry with double the delay (exponential backoff)
    return withRetry(fn, retries - 1, delayMs * 2);
  }
};

/**
 * 1. Analyze the source image
 * 2. Strip age info
 * 3. Inject character attributes
 * 4. Return detailed prompt with HEAVY emphasis on expression
 */
export const createCharacterPrompt = async (
  imageBase64: string,
  character: Character
): Promise<string> => {
  // Use Gemini 2.5 Flash for efficient, low-cost text generation
  const model = "gemini-2.5-flash";
  
  const performAnalysis = async () => {
    // Always create new instance to ensure key is fresh
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const promptText = `
CRITICAL CHARACTER TRAITS - USE EXACTLY AS SPECIFIED:
The main subject MUST be described with these exact traits: long ${character.hairColor} hair, ${character.eyeColor} eyes, ${character.skinColor} skin.
DO NOT describe or mention any other hair color, eye color, or skin tone that you see in the reference image.
IGNORE what the image shows for these traits. Use ONLY the specified traits above.
Start your prompt with these exact traits.

CRITICAL - FACIAL EXPRESSION (EXTREME DETAIL):
You must analyze the facial expression in the reference image with extreme precision.
Do NOT default to "neutral expression".
- Mouth: Are lips parted? Teeth visible? Corners turned up (smile) or down (frown)? Is there a smirk? Is the mouth relaxed?
- Eyes: Are they squinting? Wide open? Heavy lidded? Looking sideways?
- Mood: Sassy, bored, excited, angry, seductive, happy, thoughtful?
Copy this EXACT expression to the text description. If she has a "faint smirk with slightly parted lips", you MUST write exactly that.

Write a single, hyper-detailed text prompt (350–400 words).
Use only plain, objective, and neutral English—avoid all romantic, emotional, or subjective phrases.
The scene must always be described explicitly as a realistic cellphone photograph, never as a painting, illustration, render, or digital artwork.
Include clear photographic cues such as: "highly realistic photo," "natural handheld smartphone photograph," "real-world lighting," "natural sensor noise," etc.
Do not use or imply words like "illustration," "digital artwork," "render," "3D," "CGI," "cartoon," "DSLR" or "painting."
Do not guess or describe age, e.g. "early 20s", or "young woman". Simply dont mention it.
Do NOT mention or describe tattoos, ink, or body art. Even if visible in the reference, completely ignore them.

Describe with total, literal precision every visible element in the scene:
- Full-body stance details (limb angles, joint bends, weight shifts, surface contact).
- Face features! (Capture the exact MICRO-EXPRESSION analyzed above, head tilt, brow position) in realistic human proportions.
- Hair specifics: length in inches, part, style, pattern, thickness, volume, ends, accessories (but NEVER the color - use only the specified hair color).
- Outfit: each layer/item (type, collar, sleeves, cuffs, fabric weave/shade, folds, hues, patterns, edges, trims).
- Shoes: sole, upper material, fasteners, orientation to floor/ground.
- Items/Accessories: each object with dimensions, attachment points, materials, textures.
- Light: realistic sources, angle, intensity, hue, bounce, shadow character, highlights.
- View/Camera: camera height, angle, lens equivalent, horizon tilt, framing, handheld vs tripod.
- Layout: subject placement, spatial relationships, overlaps, proportional spacing, depth cues.
- Focus/Depth: sharp planes, soft regions, DOF characteristics, background blur/bokeh.
- Backdrop: wall/floor textures, materials, colors, lighting, depth cues, environment descriptors.
- Overall rendering: photorealistic camera look, natural color balance, realistic contrast/saturation, subtle lens imperfections (vignetting, grain/noise, motion blur), and specify aspect ratio.

Always target a realistic photographic style optimized for lifelike camera imagery.
Never mention inappropriate anatomy or sexualized body aspects; focus on clothing, pose, and visible surface traits only. Never suggest vignette or other post-processed effects.
Omit any language that could violate OpenAI policies or community guidelines.

Return only the prompt text—no introductions, explanations, formatting, or additional commentary.
  `;

    const call = ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          { text: promptText },
        ],
      },
      config: {
        // Set permissive safety settings to avoid false positives on "person analysis"
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ]
      }
    });

    const response = await withTimeout<GenerateContentResponse>(call, 60000, "Timeout analyzing source image. The server took too long to respond.");
    
    if (!response.text) {
        // Check for safety finish reason to give a better error
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason) {
             throw new Error(`Gemini blocked the request. Reason: ${finishReason}. Try a different image.`);
        }
        throw new Error("Gemini returned an empty description. Please try again or use a clearer image.");
    }
    
    return response.text;
  };

  try {
    // Retry analysis up to 2 times, start with 1s delay
    return await withRetry(performAnalysis, 2, 1000);
  } catch (error) {
    const msg = getErrorMessage(error);
    console.error("Error creating prompt:", msg);
    throw new Error(msg);
  }
};

/**
 * Generate the final image using "Nano Banana Pro" (gemini-3-pro-image-preview)
 * Accepts an optional character reference image to help with identity consistency.
 */
export const generateCharacterImage = async (
  prompt: string, 
  characterImageBase64?: string
): Promise<string> => {
  const model = "gemini-3-pro-image-preview";
  
  // Define the actual API call logic
  const performGeneration = async () => {
    // Always create new instance to ensure key is fresh
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const parts: any[] = [];
    
    // If a character reference image exists, pass it first to guide the model
    if (characterImageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: characterImageBase64
        }
      });
      // Adjust prompt to ensure it knows to use the image as reference
      parts.push({
        text: "Generate a photorealistic image of the character in the attached reference image, placed into the following scene description: " + prompt
      });
    } else {
      parts.push({ text: prompt });
    }

    const call = ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    // 110s timeout
    const response = await withTimeout<GenerateContentResponse>(call, 110000, "Timeout waiting for Nano Banana Pro.");

    // Iterate to find the image part
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    throw new Error("No image data found in the response from Gemini.");
  };

  try {
    // Attempt generation with 3 retries (increased from 1)
    // Start delay at 2000ms, then 4000ms, then 8000ms
    // 500 errors are often transient and resolve with retries
    return await withRetry(performGeneration, 3, 2000);
  } catch (error) {
    const msg = getErrorMessage(error);
    console.error("Error generating image:", msg);
    throw new Error(msg);
  }
};
