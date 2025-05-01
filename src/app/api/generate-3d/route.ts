import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

// Initialize Fal AI client if API key is available
const falApiKey = process.env.FAL_AI_API_KEY;

let fal: any;
if (falApiKey) {
  fal = require('@fal-ai/client').fal;
  fal.config({
    credentials: falApiKey,
  });
} else {
  console.warn('FAL_AI_API_KEY is not set in environment variables');
  // Create a mock client to prevent build errors and provide clear error messages
  fal = {
    subscribe: () => {
      throw new Error('FAL_AI_API_KEY is not set in environment variables. Please configure the API key to use 3D generation features.');
    }
  };
}

interface TrellisResponse {
  model_url: string;
}

interface SubscriptionPlan {
  model_credit_cost: number;
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
          model_credit_cost
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

    // Debug logs in the same format as image generation
    console.log('Profile data:', {
      current_plan_id: profile.current_plan_id,
      subscription_status: profile.subscription_status,
      subscription_plan: profile.subscription_plan,
      credits_balance: profile.credits_balance
    });

    // Check if user can generate 3D models based on subscription status
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
        if (profile.subscription_plan?.model_credit_cost) {
          creditCost = profile.subscription_plan.model_credit_cost;
        } else {
          // Default costs based on plan type (if not specified in database)
          creditCost = profile.current_plan_id?.toLowerCase().includes('pro') ? 142 : 100;
        }
        break;
    }

    // Check if user has enough credits
    if (profile.credits_balance < creditCost) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please purchase more credits or upgrade your plan.' },
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
          type: profile.subscription_status === 'TRIAL' ? 'TRIAL_MODEL_GENERATION' : 'MODEL_GENERATION',
          generation_type: '3D_MODEL',
          description: '3D model generation',
          created_at: new Date().toISOString()
        });

      if (transactionError) {
        console.error('Failed to record transaction:', transactionError);
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