
import { GoogleGenAI } from "@google/genai";
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
 * 4. Return detailed prompt
 */
export const createCharacterPrompt = async (
  imageBase64: string,
  character: Character
): Promise<string> => {
  // Use Gemini 2.5 Flash for efficient, low-cost text generation
  const model = "gemini-2.5-flash";
  
  // Default values for backward compatibility
  const hLength = character.hairLength || "medium length";
  const hTexture = character.hairTexture || "straight";

  const performAnalysis = async () => {
    // Always create new instance to ensure key is fresh
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const promptText = `
CRITICAL CHARACTER TRAITS - USE EXACTLY AS SPECIFIED:
The main subject MUST be described with these exact traits: ${hLength}, ${hTexture}, ${character.hairColor} hair, ${character.eyeColor} eyes, ${character.skinColor} skin.
DO NOT describe or mention any other hair color, length, texture, eye color, or skin tone that you see in the reference image.
IGNORE what the image shows for these traits. Use ONLY the specified traits above.
Start your prompt with these exact traits.

CRITICAL - ACCURATE EXPRESSION ANALYSIS:
Analyze the facial expression in the reference image with extreme precision.
Describe the exact state of the mouth (lips parted, closed, smile width), eyes (aperture, gaze direction, brow position), and head tilt.
IMPORTANT: Describe ONLY the emotion and expression. DO NOT describe the facial structure, nose shape, jawline, or bone structure of the person in the reference image.
The goal is to transfer the EXPRESSION to a different character, not the face itself.

Write a single, hyper-detailed text prompt (350–400 words).
Use vivid, descriptive English.
The scene must always be described explicitly as a realistic cellphone photograph.
Include clear photographic cues such as: "highly realistic photo," "natural handheld smartphone photograph," "real-world lighting," "natural sensor noise," etc.
Do not use or imply words like "illustration," "digital artwork," "render," "3D," "CGI," "cartoon," "DSLR" or "painting."
Do not guess or describe age.
Do NOT mention or describe tattoos, ink, or body art. Even if visible in the reference, completely ignore them.

Describe with total, literal precision every visible element in the scene:
- Full-body stance details (limb angles, joint bends, weight shifts).
- Face features: Capture the exact expression (mouth, eyes, brows) and head tilt. DO NOT describe specific identity traits like nose shape, jawline, or cheekbones (allow the image reference to define identity).
- Hair specifics: length (${hLength}), texture (${hTexture}), part, style, pattern, thickness, volume, ends, accessories (but NEVER the color, length or texture - use only the specified traits).
- Outfit: each layer/item (type, collar, sleeves, cuffs, fabric weave/shade, folds, hues, patterns, edges, trims).
- Shoes: sole, upper material, fasteners, orientation to floor/ground.
- Items/Accessories: each object with dimensions, attachment points, materials, textures.
- Light: realistic sources, angle, intensity, hue, bounce, shadow character, highlights.
- View/Camera: camera height, angle, lens equivalent, horizon tilt, framing, handheld vs tripod.
- Layout: subject placement, spatial relationships, overlaps, proportional spacing, depth cues.
- Focus/Depth: sharp planes, soft regions, DOF characteristics, background blur/bokeh.
- Backdrop: wall/floor textures, materials, colors, lighting, depth cues, environment descriptors.
- Overall rendering: photorealistic camera look, natural color balance, realistic contrast/saturation, crisp clarity, and specify aspect ratio.
- Final instruction: "The facial identity (features, bone structure) MUST strictly match the provided Reference Image."

Always target a realistic photographic style optimized for lifelike camera imagery.
Never mention inappropriate anatomy or sexualized body aspects; focus on clothing, pose, and visible surface traits only.
Omit any language that could violate OpenAI policies or community guidelines.

Return only the prompt text—no introductions, explanations, formatting, or additional commentary.
  `;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      },
    });

    if (!response.text) {
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Analysis refused. Reason: ${candidate.finishReason}. The image may have triggered safety filters.`);
      }
    }

    return response.text || "";
  };

  return withRetry(performAnalysis);
};

export const generateCharacterImage = async (
  prompt: string,
  referenceImage?: string
): Promise<string> => {
  const model = "gemini-3-pro-image-preview";

  const performGeneration = async () => {
    // Create new instance for every call to ensure latest API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts: any[] = [];

    // 1. Add Reference Image (Character Face) if available
    if (referenceImage) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: referenceImage,
        },
      });
    }

    // 2. Add Prompt
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "2K", 
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      },
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
      
      // Check for refusal on generation side too
      if (response.candidates[0].finishReason && response.candidates[0].finishReason !== 'STOP') {
         throw new Error(`Generation refused. Reason: ${response.candidates[0].finishReason}`);
      }
    }
    
    throw new Error("No image generated.");
  };

  return withRetry(performGeneration);
};
