import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

interface FalAIClient {
  subscribe: (model: string, options: any) => Promise<any>;
  config: (options: { credentials: string }) => void;
}

// Initialize Fal AI client if API key is available
const falApiKey = process.env.FAL_KEY || process.env.FAL_AI_API_KEY;

let fal: FalAIClient | null = null;
let initializationInProgress: Promise<void> | null = null;

interface TrellisResponse {
  model_mesh: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
  };
  timings?: any;
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

const initializeFalAI = async () => {
  if (!falApiKey) {
    console.error('FAL_KEY is not set in environment variables');
    return null;
  }

  try {
    const { fal: falInstance } = await import('@fal-ai/client');
    
    // Configure with credentials as shown in docs
    falInstance.config({
      credentials: falApiKey
    });
    
    console.log('FAL AI client initialized');
    return falInstance;
  } catch (error) {
    console.error('Failed to initialize FAL AI client:', error);
    return null;
  }
};

const getFalInstance = async () => {
  if (fal) {
    return fal;
  }

  if (initializationInProgress) {
    await initializationInProgress;
    return fal;
  }

  initializationInProgress = initializeFalAI().then(instance => {
    fal = instance;
  }).catch(error => {
    console.error('Initialization error:', error);
    fal = null;
  });

  await initializationInProgress;
  return fal;
};

export async function POST(req: Request) {
  try {
    fal = await getFalInstance();
    
    if (!fal) {
      console.error('FAL AI client failed to initialize');
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

    try {
      // Generate 3D model with parameters from the documentation
      const result = await fal.subscribe('fal-ai/trellis', {
        input: {
          image_url: imageUrl,
          ss_guidance_strength: 7.5,
          ss_sampling_steps: 12,
          slat_guidance_strength: 3,
          slat_sampling_steps: 12,
          mesh_simplify: 0.95,
          texture_size: 1024
        },
        logs: true,
        onQueueUpdate: (update: any) => {
          if (update.status === "IN_PROGRESS") {
            console.log('Generation progress:', update.logs?.map((log: any) => log.message));
          }
        }
      });

      console.log('Raw model response:', JSON.stringify(result, null, 2));

      // The model returns data in the 'model_mesh' property
      const modelUrl = result?.data?.model_mesh?.url || result?.model_mesh?.url;

      if (!modelUrl) {
        console.error('Invalid model response:', result);
        throw new Error('No model URL in response. Raw response: ' + JSON.stringify(result));
      }

      // Verify the model URL is accessible
      const isModelAccessible = await fetch(modelUrl, { method: 'HEAD' });
      if (!isModelAccessible.ok) {
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

      return NextResponse.json({ modelUrl });
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