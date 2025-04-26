import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generatePrompt = (style: string, material: string) => {
  return `A centered, front-facing ${style.toLowerCase()} building made of ${material.toLowerCase()}, isolated on a neutral background, no environment, clean geometry, studio lighting`;
};

export async function POST(req: Request) {
  try {
    const { prompt, style, material, size = '1024x1024', n = 4 } = await req.json();

    if (!prompt && (!style || !material)) {
      return NextResponse.json(
        { error: 'Either prompt or both style and material are required' },
        { status: 400 }
      );
    }

    // If style and material are provided, use them to generate the prompt
    const finalPrompt = style && material ? generatePrompt(style, material) : prompt;

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

    return NextResponse.json({ images: [response.data[0].url] });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
} 