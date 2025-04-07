import { NextResponse } from 'next/server';

import ollama from 'ollama';

export async function POST(req: Request) {
  try {
    const { model } = await req.json();
    
    const stream = await ollama.pull({ model, stream: true });
    const encoder = new TextEncoder();
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of stream) {
            const data = JSON.stringify(part) + '\n';
            controller.enqueue(encoder.encode(data));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to pull model' },
      { status: 500 }
    );
  }
} 