import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import OpenAI, { toFile } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RenderRequest {
  prompt: string;
  category: string;
  outputType: string;
  renderStyle: string;
  referenceImage: string | null;
  quality: 'none' | 'minor' | 'major';
}

interface DatabaseProfile {
  credits_balance: number;
  current_plan_id: string | null;
  subscription_status: string;
  subscription_plan: {
    image_credit_cost: number;
    name: string;
  } | null;
}

// Quality settings mapping for gpt-image-1
const qualitySettings = {
  none: { quality: 'low' }, // 272 tokens for 1024x1024
  minor: { quality: 'medium' }, // 1056 tokens for 1024x1024
  major: { quality: 'high' }, // 4160 tokens for 1024x1024
} as const;

// Helper function to validate quality access
function canAccessQuality(profile: DatabaseProfile, quality: 'none' | 'minor' | 'major'): boolean {
  switch (quality) {
    case 'none': // Standard quality
      return true;
    case 'minor': // Enhanced quality
      return profile.subscription_status === 'ACTIVE';
    case 'major': // Premium quality
      return profile.subscription_status === 'ACTIVE' && 
             (profile.subscription_plan?.name?.toLowerCase() || '').includes('pro');
    default:
      return false;
  }
}

function getQualityErrorMessage(quality: 'none' | 'minor' | 'major'): string {
  switch (quality) {
    case 'minor':
      return 'Enhanced quality requires an active subscription. Please upgrade to Standard or Pro plan.';
    case 'major':
      return 'Premium quality requires an active Pro subscription. Please upgrade to the Pro plan.';
    default:
      return 'Invalid quality level selected.';
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized',
        status: 401 
      });
    }

    // Parse request body
    const body = await request.json() as RenderRequest;
    const { prompt, category, outputType, renderStyle, referenceImage, quality } = body;

    if (!prompt) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input',
        message: 'Prompt is required',
        status: 400 
      });
    }

    // Get user's profile and subscription plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        credits_balance,
        current_plan_id,
        subscription_status,
        subscription_plan:subscription_plans (
          image_credit_cost,
          name
        )
      `)
      .eq('id', userId)
      .single() as { data: DatabaseProfile | null, error: any };

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

    // Validate quality level access
    if (!canAccessQuality(profile, quality)) {
      return NextResponse.json({
        success: false,
        error: 'Quality level not available',
        message: getQualityErrorMessage(quality),
        status: 403
      });
    }

    // Standard credit cost for all operations
    const creditCost = 100;

    if (profile.credits_balance < creditCost) {
      return NextResponse.json({ 
        success: false,
        error: 'Insufficient credits',
        message: 'Please purchase more credits or upgrade your plan.',
        status: 403
      });
    }

    try {
      // Create an enhanced prompt that includes all the selected options
      const stylePrompt = renderStyle === 'realistic' ? 'photorealistic' : renderStyle;
      const outputPrompt = outputType === '3D' ? '3D visualization' : outputType.toLowerCase();
      
      let enhancedPrompt = `Create a ${stylePrompt} ${outputPrompt} of a ${category} design. ${prompt}`;
      
      // Add quality-specific enhancements
      if (quality === 'major') {
        enhancedPrompt += ' Create a highly detailed, professional architectural visualization with perfect lighting, shadows, reflections, and rich textures. Pay special attention to architectural accuracy and photorealism.';
      } else if (quality === 'minor') {
        enhancedPrompt += ' Create a professional architectural visualization with good attention to detail, lighting, and composition.';
      }

      const imageGenRequest = {
        model: "gpt-image-1",
        prompt: enhancedPrompt,
        n: 1,
        quality: qualitySettings[quality].quality,
        size: "1024x1024", // Default square size
        response_format: "b64_json"
      } as const;

      // If there's a reference image, use it for variation/editing
      let apiResponse;
      if (referenceImage) {
        const imageStr = referenceImage.split('base64,').pop() || referenceImage;
        const imageBuffer = Buffer.from(imageStr, 'base64');
        const imageFile = await toFile(new Uint8Array(imageBuffer), "reference.png", { type: "image/png" });
        
        apiResponse = await openai.images.edit({
          ...imageGenRequest,
          image: [imageFile], // gpt-image-1 supports multiple reference images
        });
      } else {
        apiResponse = await openai.images.generate(imageGenRequest);
      }

      const generatedImageBase64 = apiResponse.data?.[0]?.b64_json;
      if (!generatedImageBase64) {
        throw new Error('No image data returned from OpenAI');
      }

      // Deduct credits and record transaction atomically
      const { error: dbError } = await supabase.rpc('handle_generation_deduction', {
        p_user_id: userId,
        p_generation_type: 'IMAGE',
        p_description: `Generated ${quality} quality image: ${prompt.substring(0, 100)}`
      });

      if (dbError) {
        console.error('Database error during credit deduction:', dbError);
        throw new Error(`Failed to process credit deduction: ${dbError.message}`);
      }

      // Return success with remaining credits
      return NextResponse.json({
        success: true,
        image: generatedImageBase64,
        creditsRemaining: profile.credits_balance - creditCost
      });
    
    } catch (error: any) {
      console.error('Error during OpenAI API call:', error);
      if (error?.response?.data?.error) {
        return NextResponse.json(
          { error: error.response.data.error.message },
          { status: error.response.status || 500 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error during image generation:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'An unexpected error occurred while processing your request'
      },
      { status: 500 }
    );
  }
}
