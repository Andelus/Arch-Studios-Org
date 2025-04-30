import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Supabase configuration is missing in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const generatePrompt = (style: string, material: string) => {
  return `A stunning architectural visualization of a ${style.toLowerCase()} building crafted from ${material.toLowerCase()}. The design showcases clean lines, dramatic lighting, and a minimalist aesthetic. The building is presented in a professional architectural style with perfect composition, high-end rendering quality, and a focus on architectural details. The image should be suitable for a luxury architectural portfolio. The image should be suitable for a 3D rendering.`;
};

interface SubscriptionPlan {
  image_credit_cost: number;
}

interface UserProfile {
  credits_balance: number;
  current_plan_id: string | null;
  subscription_plan?: SubscriptionPlan;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile and subscription plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        credits_balance,
        current_plan_id,
        subscription_status,
        subscription_plan:subscription_plans (
          image_credit_cost
        )
      `)
      .eq('id', userId)
      .single() as { data: UserProfile | null; error: any };

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        );
      }
      console.error('Database error:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Default credit cost for trial users is 10 (same as STANDARD plan)
    const creditCost = profile.subscription_plan?.image_credit_cost || 10;

    // Check if user has enough credits
    if (profile.credits_balance < creditCost) {
      if (profile.subscription_status === 'TRIAL') {
        return NextResponse.json(
          { error: 'You have used all your trial credits. Please subscribe to continue generating images.' },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits or upgrade your plan.' },
          { status: 403 }
        );
      }
    }

    const { prompt, style, material, size = '1024x1024' } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'A prompt is required' },
        { status: 400 }
      );
    }

    const finalPrompt = style && material ? generatePrompt(style, material) : prompt;

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: finalPrompt,
        n: 1,
        size: size as "1024x1024" | "1024x1792" | "1792x1024",
        quality: "standard",
        style: "natural",
      });

      if (!response.data?.[0]?.url) {
        throw new Error('No image URL in response');
      }

      // Deduct credits and record transaction
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          credits_balance: profile.credits_balance - creditCost
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update credits balance:', updateError);
      }

      // Record credit usage
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: -creditCost,
          type: profile.subscription_status === 'TRIAL' ? 'TRIAL_USAGE' : 'IMAGE_GENERATION',
          description: 'Image generation',
          created_at: new Date().toISOString()
        });

      if (transactionError) {
        console.error('Failed to record transaction:', transactionError);
      }

      return NextResponse.json({ images: [response.data[0].url] });
    } catch (openaiError: any) {
      console.error('OpenAI API Error:', openaiError);

      // Check if it's an API key error
      if (openaiError.message?.includes('api key') || openaiError.status === 401) {
        return NextResponse.json(
          {
            error: 'API configuration error',
            details: 'There was an issue with the image generation service configuration.',
            type: 'AUTH_ERROR'
          },
          { status: 500 }
        );
      }

      // Handle rate limits
      if (openaiError.status === 429) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            details: 'The image generation service is currently busy. Please try again in a few moments.',
            type: 'RATE_LIMIT'
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: 'Image generation failed',
          details: openaiError.message || 'An unexpected error occurred',
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