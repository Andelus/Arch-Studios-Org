import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { fal } from "@fal-ai/client";

// Initialize Fal AI client if API key is available
const falApiKey = process.env.FAL_KEY || process.env.FAL_AI_API_KEY;

if (falApiKey) {
  fal.config({
    credentials: falApiKey
  });
}

const generatePrompt = (style: string, material: string, cleanBackground: boolean = false) => {
  let prompt = '';
  const backgroundModifier = cleanBackground ? 
    ', pure white background, no environmental elements or context, clean isolated presentation' : '';

  if (style === '3D-Optimized') {
    return `Professional architectural visualization in isometric view of a building crafted from ${material.toLowerCase()}. The design must have clear geometry, minimal details, and high contrast edges, perfectly centered with clean lines and precise architectural proportions. The image must have a pure white background, clean lighting, soft shadows, simplified geometry, minimal clutter, neutral colors, photorealistic materials, centered composition, and be suitable for 3D modeling. No environmental elements or background details.`;
  }

  prompt = `A stunning architectural visualization of a ${style.toLowerCase()} building crafted from ${material.toLowerCase()}. The design showcases clean lines, dramatic lighting, and a minimalist aesthetic. The building is presented in a professional architectural style with perfect composition, high-end rendering quality, and a focus on architectural details${backgroundModifier}. The image should be suitable for a luxury architectural portfolio.`;

  return prompt;
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
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized',
        status: 401 
      });
    }

    // Get user's profile and subscription plan with a timeout
    const { data: profile, error: profileError } = await Promise.race([
      supabase
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
        .single(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      )
    ]) as { data: UserProfile | null; error: any };

    if (profileError) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ 
        success: false,
        error: profileError.code === 'PGRST116' ? 'Profile not found' : 'Failed to fetch user profile',
        details: profileError.message,
        status: profileError.code === 'PGRST116' ? 404 : 500
      });
    }

    if (!profile) {
      return NextResponse.json({ 
        success: false,
        error: 'Profile not found',
        status: 404
      });
    }

    // Check subscription status
    if (profile.subscription_status !== 'TRIAL' && profile.subscription_status !== 'ACTIVE') {
      return NextResponse.json({ 
        success: false,
        error: 'Subscription expired',
        message: 'Your subscription has expired or been cancelled. Please renew your subscription to continue.',
        status: 403
      });
    }

    // Calculate credit cost
    const creditCost = profile.subscription_status === 'TRIAL' ? 125 :
      profile.subscription_plan?.image_credit_cost ?? 
      (profile.current_plan_id?.toLowerCase().includes('pro') ? 142 : 100);

    if (profile.credits_balance < creditCost) {
      return NextResponse.json({ 
        success: false,
        error: 'Insufficient credits',
        message: 'Please purchase more credits or upgrade your plan.',
        status: 403
      });
    }

    const { prompt: userPrompt, style, material, size, cleanBackground } = await req.json();

    if (!userPrompt && (!style || !material)) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input',
        message: 'A prompt or style/material combination is required',
        status: 400
      });
    }

    const finalPrompt = style && material ? generatePrompt(style, material, cleanBackground) : userPrompt;

    // Adjust parameters for 3D-optimized style
    const inferenceSteps = style === '3D-Optimized' ? 45 : (cleanBackground ? 42 : 40);
    const guidanceScale = style === '3D-Optimized' ? 8.5 : (cleanBackground ? 8.0 : 7.5);

    // Generate image with Fal AI Flux
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      if (!falApiKey) {
        throw new Error('FAL_KEY is not configured');
      }

      // Map the size to Flux's image_size options - optimized for architecture
      const imageSize = size === '1024x1792' ? 'portrait_16_9' : 
                       size === '1792x1024' ? 'landscape_16_9' : 
                       'square_hd'; // Default to square_hd for better architectural detail

      console.log('Generating image with params:', {
        style,
        material,
        is3DOptimized: style === '3D-Optimized',
        imageSize,
        inferenceSteps,
        guidanceScale
      });

      const result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt: finalPrompt,
          image_size: imageSize,
          num_inference_steps: inferenceSteps,
          guidance_scale: guidanceScale,
          num_images: 1,
          enable_safety_checker: true
        },
        logs: true,
        onQueueUpdate: (update: any) => {
          if (update.status === "IN_PROGRESS") {
            console.log('Generation progress:', update.logs?.map((log: any) => log.message));
          }
        }
      });

      console.log('Raw Flux response:', JSON.stringify(result, null, 2));

      if (!result.data?.images?.[0]?.url) {
        console.error('Invalid Flux response structure:', result);
        throw new Error('No image URL in response');
      }

      const imageUrl = result.data.images[0].url;
      console.log('Generated image URL:', imageUrl);

      // Verify the image URL is accessible with retries
      let imageAccessible = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!imageAccessible && attempts < maxAttempts) {
        try {
          const imageResponse = await fetch(imageUrl, {
            signal: AbortSignal.timeout(10000),
            headers: {
              'Accept': 'image/jpeg,image/png,image/*'
            }
          });

          if (imageResponse.ok) {
            imageAccessible = true;
            const contentType = imageResponse.headers.get('content-type');
            console.log('Image verification successful:', { status: imageResponse.status, contentType });
          } else {
            console.warn(`Image verification attempt ${attempts + 1} failed:`, 
              { status: imageResponse.status, statusText: imageResponse.statusText });
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          }
        } catch (error) {
          console.error(`Image verification attempt ${attempts + 1} error:`, error);
        }
        attempts++;
      }

      if (!imageAccessible) {
        throw new Error('Generated image URL is not accessible after multiple attempts');
      }

      // Update credits and record transaction atomically
      const { error: dbError } = await supabase.rpc('process_image_generation', {
        p_user_id: userId,
        p_credit_cost: creditCost,
        p_is_trial: profile.subscription_status === 'TRIAL'
      });

      if (dbError) {
        console.error('Database error during credit deduction:', dbError);
        throw new Error(`Failed to process credit deduction: ${dbError.message}`);
      }

      // Log successful transaction
      console.log('Successfully processed image generation and deducted credits:', {
        userId,
        creditCost,
        newBalance: profile.credits_balance - creditCost
      });

      return NextResponse.json({
        success: true,
        url: imageUrl,
        status: 200
      });

    } catch (falError: any) {
      clearTimeout(timeoutId);
      console.error('Fal AI error:', falError);

      if (falError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: 'Request timeout',
          message: 'The image generation took too long. Please try again.',
          status: 408
        });
      }

      const errorResponse = {
        success: false,
        error: 'Generation failed',
        status: falError.status === 429 ? 429 : 500,
        message: falError.status === 429 
          ? 'The service is currently busy. Please try again in a moment.'
          : 'Failed to generate image. Please try again.'
      };

      return NextResponse.json(errorResponse);
    }

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error',
      message: 'An unexpected error occurred',
      status: 500
    });
  }
}