import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("Request received:", JSON.stringify(body));
    console.log("API Key exists:", !!process.env.ANTHROPIC_API_KEY);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: body.system,
      messages: body.messages,
    });

    console.log("Response received:", JSON.stringify(response.content));
    return Response.json({ content: response.content });
  } catch (error) {
    console.error("API Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
