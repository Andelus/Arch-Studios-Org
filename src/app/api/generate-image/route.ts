import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { fal } from "@fal-ai/client";
import { saveUserAsset } from '@/lib/asset-manager';
import { handleOrganizationModelGeneration } from '@/lib/organization-asset-manager';

// Initialize Fal AI client if API key is available
const falApiKey = process.env.FAL_KEY || process.env.FAL_AI_API_KEY;

if (falApiKey) {
  fal.config({
    credentials: falApiKey
  });
}

interface StyleModifier {
  promptPrefix?: string;
  promptSuffix?: string;
  renderingModifiers?: string;
}

const styleModifiers: Record<string, StyleModifier> = {
  '3D-Optimized': {
    promptPrefix: 'Professional architectural visualization in isometric view of',
    promptSuffix: 'with clear geometry, minimal details, and high contrast edges. The model should be perfectly centered with clean lines and precise architectural proportions.',
    renderingModifiers: 'pure white background, clean lighting, soft shadows, simplified geometry, minimal clutter, neutral colors, photorealistic materials, centered composition, architectural visualization'
  },
  'Technical Drawing': {
    promptPrefix: 'Detailed architectural line drawing of',
    promptSuffix: 'in precise technical illustration style with fine line work. Show the facade with architectural details, window frames, and ornamental elements.',
    renderingModifiers: 'black and white technical drawing, pure white background, clean architectural lines, no shading, precise geometric details, professional architectural illustration style, high contrast line work, perfectly straight lines, crisp details'
  }
};

const generatePrompt = (style: string, material: string, cleanBackground: boolean = false) => {
  let prompt = '';
  
  // Enhanced background modifiers with stronger prompt injection
  const backgroundModifier = cleanBackground ? 
    ', [ultra white background: RGB(255,255,255)], [remove all shadows], [pure white environment], [studio background: #FFFFFF], [high-key lighting], [white void]' : '';

  const modifier = styleModifiers[style];
  if (modifier) {
    const { promptPrefix, promptSuffix, renderingModifiers } = modifier;
    return `${promptPrefix} a building crafted from ${material.toLowerCase()} ${promptSuffix}${backgroundModifier}. ${renderingModifiers}${cleanBackground ? ', [perfect isolation], [pure white background: RGB(255,255,255)]' : ''}`;
  }
  
  // Default prompt for other styles
  prompt = `A stunning architectural visualization of a ${style.toLowerCase()} building crafted from ${material.toLowerCase()}. The design showcases clean lines, dramatic lighting, and a minimalist aesthetic. The building is presented in a professional architectural style with perfect composition, high-end rendering quality, and a focus on architectural details${backgroundModifier}. ${cleanBackground ? '[white background: RGB(255,255,255)], [background: pure white], [perfect isolation], [product photography], [commercial studio]' : ''} The image should be suitable for a luxury architectural portfolio.`;

  return prompt;
};

interface SubscriptionPlan {
  image_credit_cost: number;
}

interface UserProfile {
  credits_balance: number;
  current_plan_id: string | null;
  subscription_status: string;
  organization_id: string | null;
  subscription_plan?: SubscriptionPlan;
}

type ImageSize = 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9';

interface FluxRequestInput {
  prompt: string;
  image_size: ImageSize;
  num_inference_steps: number;
  guidance_scale: number;
  num_images: number;
  enable_safety_checker: boolean;
  seed?: number;
  negative_prompt?: string;
}

export async function POST(req: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user profile with organization data
    const { data: profile, error: profileError } = await Promise.race([
      supabase
        .from('profiles')
        .select(`
          credits_balance,
          current_plan_id,
          subscription_status,
          organization_id,
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

    // Check if user belongs to an organization
    if (profile.organization_id) {
      // Try to use organization subscription first
      const orgResult = await handleOrganizationModelGeneration(profile.organization_id, 'image');
      
      if (orgResult.canGenerate) {
        console.log('Using organization subscription for image generation');
        
        // If we're using trial credits, log info about remaining credits
        if (orgResult.trialCreditsUsed) {
          console.log(`Organization trial credits used. Remaining: ${orgResult.creditsRemaining}`);
        }
        
        // Continue with generation without deducting user credits
      } else {
        // Organization can't cover this - fall back to user's personal subscription/credits
        console.log('Organization subscription unavailable or insufficient credits. Falling back to personal credits.');
        
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
        const creditCost = profile.subscription_status === 'TRIAL' ? 100 :
          profile.subscription_plan?.image_credit_cost ?? 
          (profile.current_plan_id?.toLowerCase().includes('pro') ? 100 : 100);

        if (profile.credits_balance < creditCost) {
          return NextResponse.json({ 
            success: false,
            error: 'Insufficient credits',
            message: 'Please purchase more credits or upgrade your plan.',
            status: 403
          });
        }
      }
    } else {
      // User is not part of an organization - use personal credits
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
      const creditCost = profile.subscription_status === 'TRIAL' ? 100 :
        profile.subscription_plan?.image_credit_cost ?? 
        (profile.current_plan_id?.toLowerCase().includes('pro') ? 100 : 100);

      if (profile.credits_balance < creditCost) {
        return NextResponse.json({ 
          success: false,
          error: 'Insufficient credits',
          message: 'Please purchase more credits or upgrade your plan.',
          status: 403
        });
      }
    }

    const { prompt: userPrompt, style, material, size, cleanBackground } = await req.json();

    if (!userPrompt && !style && !material) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input',
        message: 'Please provide either a prompt or at least one style or material selection',
        status: 400
      });
    }

    let finalPrompt;
    if (style && material) {
      // Full style + material prompt
      finalPrompt = generatePrompt(style, material, cleanBackground);
    } else {
      // Handle individual modifiers
      let basePrompt = userPrompt || 'an architectural design';
      
      if (style) {
        // Apply style modifiers if available
        const modifier = styleModifiers[style];
        if (modifier) {
          const { promptPrefix, promptSuffix, renderingModifiers } = modifier;
          basePrompt = `${promptPrefix} ${basePrompt} ${promptSuffix}. ${renderingModifiers}`;
        } else {
          basePrompt = `A ${style.toLowerCase()} architectural visualization of ${basePrompt}. The design showcases clean lines, dramatic lighting, and a minimalist aesthetic, with perfect composition and high-end rendering quality`;
        }
      }
      
      if (material) {
        basePrompt = basePrompt.includes('crafted from') ? 
          basePrompt.replace(/crafted from [\w\s]+/, `crafted from ${material.toLowerCase()}`) : 
          `${basePrompt}, crafted from ${material.toLowerCase()}`;
      }
      
      // Add clean background modifiers if enabled
      const backgroundModifier = cleanBackground ? 
        ' [ultra white background: RGB(255,255,255)], [remove all shadows], [pure white environment], [studio background: #FFFFFF], [high-key lighting], [white void], [perfect isolation], [product photography], [commercial studio]' : '';

      finalPrompt = `${basePrompt}${backgroundModifier}`;
    }

    // Adjust parameters for clean background
    const inferenceSteps = cleanBackground ? 50 : (style === '3D-Optimized' ? 45 : 40); // More steps for cleaner edges
    const guidanceScale = cleanBackground ? 9.0 : (style === '3D-Optimized' ? 8.5 : 7.5); // Higher guidance for precise background control

    // Generate image with Fal AI Flux
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      if (!falApiKey) {
        throw new Error('FAL_KEY is not configured');
      }

      // Map the size to Flux's image_size options - optimized for architecture
      const imageSize: ImageSize = size === '1024x1792' ? 'portrait_16_9' : 
                       size === '1792x1024' ? 'landscape_16_9' : 
                       'square_hd'; // Default to square_hd for better architectural detail

      const fluxInput: FluxRequestInput = {
        prompt: finalPrompt,
        image_size: imageSize,
        num_inference_steps: inferenceSteps,
        guidance_scale: guidanceScale,
        num_images: 1,
        enable_safety_checker: true,
        seed: Math.floor(Math.random() * 999899999) + 100000, // Always use a random high seed
        ...(cleanBackground ? {
          negative_prompt: 'background details, shadows on background, gradients, ambient occlusion, environment, context, terrain, sky, clouds, trees, landscape, ground, floor shadows, atmospheric effects, any background elements, shadow bleeding, soft edges, environmental reflections, background texture, depth markers, perspective lines, ground plane, surface contact, ambient lighting effects, color bleeding, atmospheric perspective, background noise, environmental interaction, background patterns, backdrop, scene context, surrounding elements, environmental shadows, background blur, depth of field, environmental lighting, background gradients, light scatter, atmospheric haze, background detail, environmental detail, depth cues, scene setting, contextual elements'
        } : {})
      };

      // Enhanced logging for prompt debugging
      console.log('Generation details:', {
        style,
        material,
        is3DOptimized: style === '3D-Optimized',
        cleanBackground,
        imageSize,
        inferenceSteps,
        guidanceScale,
        finalPrompt,
        backgroundSettings: cleanBackground ? {
          prompt_injections: [
            '[ultra white background: RGB(255,255,255)]',
            '[remove all shadows]',
            '[pure white environment]',
            '[studio background: #FFFFFF]',
            '[high-key lighting]',
            '[white void]'
          ],
          negative_prompt: fluxInput.negative_prompt,
          guidance_scale: guidanceScale,
          inference_steps: inferenceSteps
        } : 'standard background'
      });

      const result = await fal.subscribe("fal-ai/flux/dev", {
        input: fluxInput,
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

      // Standard credit cost for image generation
      const creditCost = 10;

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

      // Save the generated asset to the user_assets table
      try {
        const assetSaveResult = await saveUserAsset({
          userId,
          assetType: 'image',
          assetUrl: imageUrl,
          prompt: finalPrompt,
          metadata: {
            style,
            material,
            cleanBackground,
            size: imageSize
          }
        });

        if (!assetSaveResult.success) {
          // Log the error but don't fail the request
          console.error('Failed to save user asset:', assetSaveResult.error);
        } else {
          console.log('Successfully saved user asset:', assetSaveResult.data?.id);
        }
      } catch (assetError) {
        // Log the error but don't fail the request
        console.error('Exception saving user asset:', assetError);
      }

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