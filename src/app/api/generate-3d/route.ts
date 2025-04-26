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
        prompt: prompt || 'Create a high-end architectural 3D model with precise geometry, clean lines, and professional detailing. The model should be suitable for architectural visualization and portfolio presentation.',
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
  } catch (error: any) {
    console.error('Error generating 3D model:', error);
    
    // Check for billing/credit related errors
    if (error.message?.includes('billing') || 
        error.message?.includes('credit') || 
        error.message?.includes('quota') ||
        error.message?.includes('payment') ||
        error.status === 402) {
      return NextResponse.json(
        { 
          error: 'Billing or credit issue',
          details: 'Please check your Fal AI account credits or billing status',
          type: 'BILLING_ERROR'
        },
        { status: 402 }
      );
    }

    // Check for API key related errors
    if (error.message?.includes('api key') || 
        error.message?.includes('authentication') ||
        error.status === 401) {
      return NextResponse.json(
        { 
          error: 'Authentication error',
          details: 'Invalid or missing Fal AI API key',
          type: 'AUTH_ERROR'
        },
        { status: 401 }
      );
    }

    // Other API errors
    return NextResponse.json(
      { 
        error: 'Failed to generate 3D model',
        details: error.message || 'Unknown error occurred',
        type: 'API_ERROR'
      },
      { status: 500 }
    );
  }
} 