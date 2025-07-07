import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  return NextResponse.json({
    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
    apiKeyLength: apiKey?.length || 0,
    hasApiKey: !!apiKey,
    allNextPublicVars: Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_'))
      .reduce((acc, key) => {
        acc[key] = process.env[key] ? `${process.env[key]!.substring(0, 10)}...` : 'undefined';
        return acc;
      }, {} as Record<string, string>)
  });
} 