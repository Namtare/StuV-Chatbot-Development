import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { model, prompt, messages } = body;

    // Ollama API endpoint
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    // Format the request for Ollama's chat API
    const ollamaRequest = {
      model: "llama3.1:8b",
      messages: messages || [
        {
          role: "user",
          content: prompt || body.content || "",
        },
      ],
      stream: false,
    };

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      content: [
        {
          text: data.message.content,
        },
      ],
      model: data.model,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
      },
    });
  } catch (error) {
    console.error("Error calling Ollama:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaUrl}/api/tags`);

    if (!response.ok) {
      throw new Error("Ollama service not available");
    }

    const data = await response.json();

    return NextResponse.json({
      status: "ok",
      models: data.models || [],
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 503 }
    );
  }
}
