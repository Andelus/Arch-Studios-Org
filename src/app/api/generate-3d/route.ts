import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

interface FalAIClient {
  subscribe: (model: string, options: any) => Promise<any>;
  config: (options: { credentials: string }) => void;
}

// Initialize Fal AI client if API key is available
const falApiKey = process.env.FAL_AI_API_KEY;

let fal: FalAIClient | null = null;
const initializeFalAI = async () => {
  if (!falApiKey) {
    console.error('FAL_AI_API_KEY is not set in environment variables');
    return null;
  }

  try {
    const falModule = await import('@fal-ai/client');
    const falInstance = falModule.fal;
    falInstance.config({
      credentials: falApiKey,
    });
    console.log('FAL AI client initialized successfully');
    return falInstance;
  } catch (error) {
    console.error('Failed to initialize FAL AI client:', error);
    return null;
  }
};

// Initialize fal on first import
initializeFalAI().then(instance => {
  fal = instance;
});

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
    // Check FAL AI configuration first
    if (!fal) {
      console.error('FAL AI client is not initialized');
      return NextResponse.json({
        error: 'Service configuration error',
        details: 'The 3D generation service is not properly configured. Please contact support.',
        type: 'CONFIG_ERROR'
      }, { status: 503 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, imageUrl } = await req.json();

    // Validate input
    if (!imageUrl && !prompt) {
      return NextResponse.json(
        { error: 'Either imageUrl or prompt is required' },
        { status: 400 }
      );
    }

    // Validate image URL if provided
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        if (!url.protocol.startsWith('http')) {
          return NextResponse.json(
            { error: 'Invalid image URL protocol' },
            { status: 400 }
          );
        }
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid image URL format' },
          { status: 400 }
        );
      }
    }

    // Get user's profile with retry mechanism
    const getProfile = async (retries = 3): Promise<UserProfile | null> => {
      for (let i = 0; i < retries; i++) {
        try {
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
            if (i === retries - 1) throw profileError;
            continue;
          }
          return profile;
        } catch (error) {
          if (i === retries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
      return null;
    };

    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check subscription status
    if (profile.subscription_status !== 'TRIAL' && profile.subscription_status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your subscription has expired or been cancelled. Please renew your subscription to continue using this feature.' },
        { status: 403 }
      );
    }

    // Determine credit cost
    const creditCost = profile.subscription_status === 'TRIAL' ? 125 :
      profile.subscription_plan?.model_credit_cost ??
      (profile.current_plan_id?.toLowerCase().includes('pro') ? 142 : 100);

    if (profile.credits_balance < creditCost) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please purchase more credits or upgrade your plan.' },
        { status: 403 }
      );
    }

    // Verify model URL with timeout and retries
    const verifyModelUrl = async (url: string, maxRetries = 3, timeout = 10000): Promise<boolean> => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          if (response.ok) return true;
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
      return false;
    };

    try {
      // Generate 3D model
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

      // Verify the model URL is accessible
      const isModelAccessible = await verifyModelUrl(response.model_url);
      if (!isModelAccessible) {
        throw new Error('Generated model URL is not accessible');
      }

      // Deduct credits atomically with a transaction
      const { error: transactionError } = await supabase.rpc('deduct_credits_and_log', {
        p_user_id: userId,
        p_credit_amount: creditCost,
        p_transaction_type: profile.subscription_status === 'TRIAL' ? 'TRIAL_MODEL_GENERATION' : 'MODEL_GENERATION',
        p_generation_type: '3D_MODEL',
        p_description: '3D model generation'
      });

      if (transactionError) {
        console.error('Failed to process credit transaction:', transactionError);
        throw new Error('Failed to process credit transaction');
      }

      return NextResponse.json({ modelUrl: response.model_url });
    } catch (falError: any) {
      console.error('Fal AI Error:', falError);

      if (falError.message?.includes('api key') || falError.status === 401) {
        return NextResponse.json({
          error: 'API configuration error',
          details: 'There was an issue with the 3D generation service configuration.',
          type: 'AUTH_ERROR'
        }, { status: 500 });
      }

      if (falError.status === 429 || falError.message?.includes('rate limit')) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          details: 'The 3D generation service is currently busy. Please try again in a few moments.',
          type: 'RATE_LIMIT'
        }, { status: 429 });
      }

      if (falError.message?.includes('quota') || falError.status === 402) {
        return NextResponse.json({
          error: 'Service quota exceeded',
          details: 'The 3D generation service quota has been exceeded. Please try again later.',
          type: 'QUOTA_ERROR'
        }, { status: 402 });
      }

      return NextResponse.json({
        error: '3D model generation failed',
        details: falError.message || 'An unexpected error occurred',
        type: 'API_ERROR'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      error: 'Server error',
      details: 'An unexpected error occurred',
      type: 'SERVER_ERROR'
    }, { status: 500 });
  }
}