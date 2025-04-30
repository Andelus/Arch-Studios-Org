import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Validate environment variables
if (!process.env.FAL_AI_API_KEY) {
  throw new Error('FAL_AI_API_KEY is not set in environment variables');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Supabase configuration is missing in environment variables');
}

// Initialize Fal AI client
fal.config({
  credentials: process.env.FAL_AI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface TrellisResponse {
  model_url: string;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user's subscription and 3D generation count
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status, model_generations_count')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Database error:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // If user has no subscription and has already used their free generation
    if (!profile.subscription_status && profile.model_generations_count >= 1) {
      return NextResponse.json(
        { error: 'Free plan limit reached. Please subscribe to generate more 3D models.' },
        { status: 403 }
      );
    }

    const { prompt, imageUrl } = await req.json();

    if (!imageUrl && !prompt) {
      return NextResponse.json(
        { error: 'Either imageUrl or prompt is required' },
        { status: 400 }
      );
    }

    try {
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
        throw new Error('No model URL in response');
      }

      // Increment the user's 3D model generation count
      if (!profile.subscription_status) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ model_generations_count: (profile.model_generations_count || 0) + 1 })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update generation count:', updateError);
        }
      }

      return NextResponse.json({ modelUrl: response.model_url });
    } catch (falError: any) {
      console.error('Fal AI Error:', falError);

      // Check if it's an API key error
      if (falError.message?.includes('api key') || falError.status === 401) {
        return NextResponse.json(
          {
            error: 'API configuration error',
            details: 'There was an issue with the 3D generation service configuration.',
            type: 'AUTH_ERROR'
          },
          { status: 500 }
        );
      }

      // Handle credit/quota errors
      if (
        falError.message?.includes('billing') ||
        falError.message?.includes('credit') ||
        falError.message?.includes('quota') ||
        falError.status === 402
      ) {
        return NextResponse.json(
          {
            error: 'Service quota exceeded',
            details: 'The 3D generation service quota has been exceeded. Please try again later.',
            type: 'QUOTA_ERROR'
          },
          { status: 402 }
        );
      }

      // Handle rate limits
      if (falError.status === 429) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            details: 'The 3D generation service is currently busy. Please try again in a few moments.',
            type: 'RATE_LIMIT'
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: '3D model generation failed',
          details: falError.message || 'An unexpected error occurred',
          type: 'API_ERROR'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        details: 'An unexpected error occurred',
        type: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}