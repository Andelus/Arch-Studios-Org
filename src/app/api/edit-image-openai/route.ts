import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import OpenAI, { toFile } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface InpaintingRequest {
  image: string; // Base64-encoded image
  mask: string;  // Base64-encoded mask
  prompt: string;
  drawAssist: string; // none, minor, major
}

interface UserProfile {
  credits_balance: number;
  current_plan_id: string | null;
  subscription_status: string;
  subscription_plan: {
    image_credit_cost: number;
  } | null;
}

// Define the database response type
type DbResult<T> = {
  data: T | null;
  error: Error | null;
};

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
    const body = await request.json() as InpaintingRequest;
    const { image, mask, prompt, drawAssist } = body;

    if (!image || !mask || !prompt) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input',
        message: 'Image, mask, and prompt are required',
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
          image_credit_cost
        )
      `)
      .eq('id', userId)
      .single<UserProfile>();

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

    // Process inpainting request with OpenAI
    try {
      console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);
      console.log('Starting image processing...');
      
      // Properly extract base64 data, removing any data URL prefix
      const imageStr = image.split('base64,').pop() || image;
      const maskStr = mask.split('base64,').pop() || mask;
      
      // Convert to buffers
      const imageBuffer = Buffer.from(imageStr, 'base64');
      const maskBuffer = Buffer.from(maskStr, 'base64');
      
      // Add debug logging
      console.log('Debug - Image format:', {
        originalLength: image.length,
        strippedLength: imageStr.length,
        bufferLength: imageBuffer.length,
        hasPrefix: image.includes('data:'),
        firstBytes: imageBuffer.slice(0, 4).toString('hex')
      });
      
      console.log('Debug - Mask format:', {
        originalLength: mask.length,
        strippedLength: maskStr.length,
        bufferLength: maskBuffer.length,
        hasPrefix: mask.includes('data:'),
        firstBytes: maskBuffer.slice(0, 4).toString('hex')
      });

      // Validate image data
      if (imageBuffer.length === 0 || maskBuffer.length === 0) {
        throw new Error('Invalid image or mask data');
      }

      // Adjust prompt based on the draw assist level
      let enhancedPrompt = prompt;
      if (drawAssist === 'minor') {
        enhancedPrompt = `Modify the selected area of the image to: ${prompt}. Make subtle changes that blend well with the rest of the image.`;
      } else if (drawAssist === 'major') {
        enhancedPrompt = `Transform the selected area of the image to: ${prompt}. Make significant changes that fulfill the creative vision.`;
      } else {
        enhancedPrompt = `Make minimal changes to the selected area of the image to: ${prompt}. Preserve most of the original details and style.`;
      }
      
      // Log the request (without the large image data) for debugging
      console.log(`Processing OpenAI inpainting request with: prompt="${enhancedPrompt}", drawAssist="${drawAssist}"`);
      
      // Create image and mask files
      const imageFile = await toFile(new Uint8Array(imageBuffer), "image.png", { type: "image/png" });
      const maskFile = await toFile(new Uint8Array(maskBuffer), "mask.png", { type: "image/png" });
    
      console.log('Debug - Files prepared:', {
        imageFile: Boolean(imageFile),
        maskFile: Boolean(maskFile),
        imageSize: imageBuffer.length,
        maskSize: maskBuffer.length
      });
      
      console.log('Making OpenAI API call with params:', {
        model: "gpt-image-1",
        prompt: enhancedPrompt,
        size: "1024x1024",
        quality: drawAssist === 'major' ? 'high' : 'medium'
      });

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        mask: maskFile,
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: drawAssist === 'major' ? 'high' : 'medium',
        response_format: "b64_json"
      });

      // Get the edited image base64
      const editedImageBase64 = response.data?.[0]?.b64_json;
      if (!editedImageBase64) {
        return NextResponse.json({ error: 'No image data returned from OpenAI' }, { status: 500 });
      }

      // Deduct credits and record transaction atomically
      const { error: dbError } = await supabase.rpc('process_image_generation', {
        p_user_id: userId,
        p_credit_cost: creditCost,
        p_is_trial: profile.subscription_status === 'TRIAL'
      });

      if (dbError) {
        console.error('Database error during credit deduction:', dbError);
        throw new Error(`Failed to process credit deduction: ${dbError.message}`);
      }

      // Return success with remaining credits
      return NextResponse.json({
        success: true,
        image: editedImageBase64,
        creditsRemaining: profile.credits_balance - creditCost
      });
    
    } catch (error: any) {
      // Log the full error details for debugging
      console.error('Error during OpenAI API call:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        type: error?.type,
        stack: error?.stack,
        response: {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data,
          headers: error?.response?.headers
        },
        raw: error
      });

      // Handle specific OpenAI API errors
      if (error?.response?.data?.error) {
        return NextResponse.json(
          { error: error.response.data.error.message },
          { status: error.response.status || 500 }
        );
      }

      throw error; // Re-throw to be caught by outer catch block
    }
  } catch (error: any) {
    console.error('Error during image editing:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'An unexpected error occurred while processing your request'
      },
      { status: 500 }
    );
  }
}
