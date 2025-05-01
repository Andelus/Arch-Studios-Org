import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

// Initialize OpenAI client if API key is available
const openaiApiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI;
if (openaiApiKey) {
  openai = new OpenAI({
    apiKey: openaiApiKey,
  });
} else {
  console.warn('OPENAI_API_KEY is not set in environment variables');
  // Create a mock client to prevent build errors
  openai = {
    images: {
      generate: () => {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
      }
    }
  } as unknown as OpenAI;
}

const generatePrompt = (style: string, material: string) => {
  return `A stunning architectural visualization of a ${style.toLowerCase()} building crafted from ${material.toLowerCase()}. The design showcases clean lines, dramatic lighting, and a minimalist aesthetic. The building is presented in a professional architectural style with perfect composition, high-end rendering quality, and a focus on architectural details. The image should be suitable for a luxury architectural portfolio. The image should be suitable for a 3D rendering.`;
};

interface SubscriptionPlan {
  image_credit_cost: number;
}

interface UserProfile {
  credits_balance: number;
  current_plan_id: string | null;
  subscription_status: string;
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

    // Debug logs
    console.log('Profile data:', {
      current_plan_id: profile?.current_plan_id,
      subscription_status: profile?.subscription_status,
      subscription_plan: profile?.subscription_plan,
      credits_balance: profile?.credits_balance
    });

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

    // Check if user can generate images based on subscription status
    if (profile.subscription_status !== 'TRIAL' && profile.subscription_status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your subscription has expired or been cancelled. Please renew your subscription to continue using this feature.' },
        { status: 403 }
      );
    }

    // Determine credit cost based on subscription status
    let creditCost = 100; // Default for Standard plan
    
    switch (profile.subscription_status) {
      case 'TRIAL':
        // For trial users, use 125 credits
        creditCost = 125;
        break;
      case 'ACTIVE':
        // For active paid users, use the plan's credit cost or default
        if (profile.subscription_plan?.image_credit_cost) {
          creditCost = profile.subscription_plan.image_credit_cost;
        } else {
          // Default costs based on plan type (if not specified in database)
          creditCost = profile.current_plan_id?.toLowerCase().includes('pro') ? 142 : 100;
        }
        break;
    }
    console.log('Using credit cost:', creditCost);

    // Check if user has enough credits
    if (profile.credits_balance < creditCost) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please purchase more credits or upgrade your plan.' },
        { status: 403 }
      );
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
          type: profile.subscription_status === 'TRIAL' ? 'TRIAL_IMAGE_GENERATION' : 'IMAGE_GENERATION',
          generation_type: 'IMAGE',
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