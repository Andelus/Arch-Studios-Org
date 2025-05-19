import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { saveUserAsset } from '@/lib/asset-manager';
import { handleOrganizationModelGeneration } from '@/lib/organization-asset-manager';

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
  organization_id: string | null;
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
              organization_id,
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

    // Check if user belongs to an organization
    if (profile.organization_id) {
      // Try to use organization subscription first
      const orgResult = await handleOrganizationModelGeneration(profile.organization_id, '3d');
      
      if (orgResult.canGenerate) {
        console.log('Using organization subscription for model generation');
        
        // If we're using trial credits, log info about remaining credits
        if (orgResult.trialCreditsUsed) {
          console.log(`Organization trial credits used. Remaining: ${orgResult.creditsRemaining}`);
        }
        
        // No need to check user's personal credits if org subscription covers it
        // Continue with generation without deducting user credits
      } else {
        // Organization can't cover this - fall back to user's personal subscription/credits
        console.log('Organization subscription unavailable or insufficient trial credits. Falling back to personal credits.');
        
        // The rest of this code is the fallback to personal credits
        // Check subscription status
        if (profile.subscription_status !== 'TRIAL' && profile.subscription_status !== 'ACTIVE') {
          return NextResponse.json(
            { error: 'Your subscription has expired or been cancelled. Please renew your subscription to continue using this feature.' },
            { status: 403 }
          );
        }

        // Standard credit cost for 3D generation is 10 credits
        const creditCost = 10;

        if (profile.credits_balance < creditCost) {
          return NextResponse.json(
            { error: 'Insufficient credits. Please purchase more credits or upgrade your plan.' },
            { status: 403 }
          );
        }
      }
    } else {
      // User is not part of an organization - use personal credits
      // Check subscription status
      if (profile.subscription_status !== 'TRIAL' && profile.subscription_status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'Your subscription has expired or been cancelled. Please renew your subscription to continue using this feature.' },
          { status: 403 }
        );
      }

      // Standard credit cost for 3D generation is 10 credits
      const creditCost = 10;

      if (profile.credits_balance < creditCost) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits or upgrade your plan.' },
          { status: 403 }
        );
      }
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

      // Only deduct from personal credits if not using organization subscription
      // Check if user belongs to organization first
      let skipPersonalCreditDeduction = false;
      
      if (profile.organization_id) {
        const orgResult = await handleOrganizationModelGeneration(profile.organization_id, '3d');
        if (orgResult.canGenerate) {
          skipPersonalCreditDeduction = true;
        }
      }
      
      if (!skipPersonalCreditDeduction) {
        // Standard credit cost for 3D generation is 10 credits
        const creditCost = 10;
        
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
      } else {
        console.log('Using organization credits - skipping personal credit deduction');
      }
      
      // Save the 3D model to user_assets table (with organization support)
      try {
        // Get the user's current profile to check organization
        const user = await currentUser();
        let organizationId: string | undefined = undefined;
        
        // Check if the user is part of an organization
        if (profile.organization_id) {
          organizationId = profile.organization_id;
        }
        
        const assetSaveResult = await saveUserAsset({
          userId,
          assetType: '3d',
          assetUrl: modelUrl,
          prompt: prompt || 'Generated from image',
          organizationId,  // This will be undefined if user is not part of an organization
          metadata: {
            sourceImageUrl: imageUrl,
            modelFormat: 'glb',
            generatedAt: new Date().toISOString(),
            generatedBy: user?.firstName || userId,
          }
        });

        if (!assetSaveResult.success) {
          // Log the error but don't fail the request
          console.error('Failed to save 3D asset:', assetSaveResult.error);
        } else {
          console.log(`Successfully saved 3D asset ${assetSaveResult.data?.id} ${organizationId ? 'for organization ' + organizationId : 'for individual user'}`);
        }
      } catch (assetError) {
        // Log the error but don't fail the request
        console.error('Exception saving 3D asset:', assetError);
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