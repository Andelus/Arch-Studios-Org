// Types used across the image editing features

export type DrawAssistLevel = 'none' | 'minor' | 'major';

export interface InpaintingRequest {
  image: string; // Base64-encoded image
  mask: string;  // Base64-encoded mask
  prompt: string;
  drawAssist: DrawAssistLevel;
}

export interface InpaintingResponse {
  image: string;  // Base64-encoded result image
  creditsRemaining: number;
}
