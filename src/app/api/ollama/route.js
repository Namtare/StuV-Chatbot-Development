import { NextResponse } from "next/server";
import { orchestrateLLMConversation } from "@/lib/llm-orchestration";

export async function POST(req) {
  try {
    const body = await req.json();
    const { model, prompt, messages } = body;

    // Format messages
    const conversationMessages = messages || [
      {
        role: "user",
        content: prompt || body.content || "",
      },
    ];

    // Orchestrate the conversation with tool calling support
    const result = await orchestrateLLMConversation(conversationMessages, {
      model: model || "llama3.1:8b",
    });

    return NextResponse.json({
      content: [
        {
          text: result.content,
        },
      ],
      model: result.model,
      usage: result.usage,
    });
  } catch (error) {
    console.error("Error in LLM orchestration:", error);
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
