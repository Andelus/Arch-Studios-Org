import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

// Initialize Fal AI client
fal.config({
  credentials: process.env.FAL_AI_API_KEY,
});

interface TrellisResponse {
  model_url: string;
}

export async function POST(req: Request) {
  try {
    const { prompt, imageUrl } = await req.json();

    if (!imageUrl && !prompt) {
      return NextResponse.json(
        { error: 'Either imageUrl or prompt is required' },
        { status: 400 }
      );
    }

    // Call Fal AI Trellis API
    const result = await fal.subscribe('fal-ai/trellis-3d', {
      input: {
        prompt: prompt || 'Generate a 3D model from this image',
        image_url: imageUrl,
        model: 'trellis-3d',
        output_format: 'glb',
      },
    });

    const response = result as unknown as TrellisResponse;

    if (!response.model_url) {
      throw new Error('Failed to generate 3D model');
    }

    return NextResponse.json({ modelUrl: response.model_url });
  } catch (error) {
    console.error('Error generating 3D model:', error);
    return NextResponse.json(
      { error: 'Failed to generate 3D model' },
      { status: 500 }
    );
  }
} 