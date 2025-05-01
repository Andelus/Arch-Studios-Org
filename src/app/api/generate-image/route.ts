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
  openai = {
    images: {
      generate: () => {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
      }
    }
  } as unknown as OpenAI;
}

const generatePrompt = (style: string, material: string) => {
  if (style === '3D') {
    return `Create an ultra-high-definition architectural visualization optimized for 3D conversion. The building should utilize ${material.toLowerCase()} as the primary material.

Key requirements:
- Clean orthographic or 3/4 perspective view with precise geometric forms
- Hyper-detailed structural elements with clear depth information
- Sharp edges and well-defined surfaces suitable for 3D modeling
- Perfect scale proportions and architectural measurements
- Crisp material texturing showing surface properties of ${material.toLowerCase()}
- Studio lighting that emphasizes form and volume
- Neutral background with subtle depth grid
- No people or environmental clutter
- Technical accuracy in construction details and joints

Technical specifications:
- Maximum detail preservation for 3D conversion
- Professional CAD-like precision in all elements
- Perfect edge definition and surface topology
- Clear separation between architectural elements`;
  }

  return `Create an ultra-high-definition architectural visualization of a ${style.toLowerCase()} building utilizing ${material.toLowerCase()} as the primary material. 

Key architectural requirements:
- Precise technical architectural representation with accurate scale and proportions
- Hyper-detailed structural elements and architectural features
- Professional architectural documentation quality with crisp edges and clear depth
- Masterful material representation with accurate texturing and surface detail
- Studio-quality lighting that emphasizes architectural form and spatial relationships
- Clean, architectural background with proper perspective grid
- Perfect symmetry and geometric precision where appropriate
- Technical accuracy in construction details and joints
- Clear delineation of different architectural planes and surfaces
- Architectural-grade rendering quality suitable for professional documentation

Composition requirements:
- Primary view should be a clear architectural elevation or precise 3/4 perspective
- Include subtle depth cues and shadow detail for enhanced dimensionality
- Maintain perfect vertical and horizontal alignments
- Ensure mathematical precision in all proportions and angles
- Maximum clarity for potential 3D conversion

Technical specifications:
- Ultra-high-definition output with maximum detail preservation
- Professional architectural visualization standards
- Perfect edge definition and surface detail
- RAW-like quality for maximum post-processing potential`;
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

    const { prompt, style, material, size = '1024x1024' } = await req.json();

    if (!prompt && (!style || !material)) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input',
        message: 'A prompt or style/material combination is required',
        status: 400
      });
    }

    const finalPrompt = style && material ? generatePrompt(style, material) : prompt;

    // Generate image with OpenAI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: finalPrompt,
        n: 1,
        size: "1792x1024", // Using the highest available resolution
        quality: "hd", // Using HD quality
        style: "natural", // Keeping natural style for architectural accuracy
      }, { 
        signal: controller.signal as AbortSignal 
      });

      clearTimeout(timeoutId);

      if (!response.data?.[0]?.url) {
        throw new Error('No image URL in response');
      }

      const imageUrl = response.data[0].url;

      // Verify and process the image
      try {
        const imageResponse = await fetch(imageUrl, {
          signal: AbortSignal.timeout(10000)
        });

        if (!imageResponse.ok) {
          throw new Error('Generated image URL is not accessible');
        }

        // Always convert OpenAI URLs to data URLs to prevent expiration issues
        const imageData = await imageResponse.arrayBuffer();
        const base64Data = Buffer.from(imageData).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        const dataUrl = `data:${contentType};base64,${base64Data}`;

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
          url: dataUrl,
          status: 200
        });

      } catch (processError) {
        console.error('Image processing error:', processError);
        throw new Error('Failed to process generated image');
      }

    } catch (openaiError: any) {
      clearTimeout(timeoutId);
      console.error('OpenAI error:', openaiError);

      if (openaiError.name === 'AbortError') {
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
        status: openaiError.status === 429 ? 429 : 500,
        message: openaiError.status === 429 
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