import { NextResponse } from 'next/server';
import ollama from 'ollama';

export async function GET() {
  try {
    const models = await ollama.list();
    return NextResponse.json(models);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
} 