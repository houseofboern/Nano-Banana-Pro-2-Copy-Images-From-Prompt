export interface Character {
  id: string;
  name: string;
  hairColor: string;
  eyeColor: string;
  skinColor: string;
  avatarImage?: string; // Base64 reference image for the character
}

export type GenerationStatus = 'processing' | 'completed' | 'failed';

export interface GeneratedImage {
  id: string;
  characterId: string;
  imageData?: string; // Base64, optional until completed
  prompt: string;
  createdAt: number;
  status: GenerationStatus;
  errorMessage?: string;
}

export interface AppState {
  characters: Character[];
  selectedCharacterId: string | null;
  generatedImages: GeneratedImage[];
  isGenerating: boolean; // Deprecated in favor of individual image status, kept for backward compat if needed
  loadingMessage: string;
}