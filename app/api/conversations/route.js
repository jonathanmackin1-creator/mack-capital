import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function GET() {
  try {
    const index = await redis.get("conv_index") || [];
    return Response.json({ conversations: index });
  } catch {
    return Response.json({ conversations: [] });
  }
}

export async function POST(request) {
  try {
    const { messages } = await request.json();
    const id = Date.now().toString();
    const firstUserMsg = messages.find(m => m.role === "user")?.content || "Conversation";
    const title = firstUserMsg.slice(0, 50);
    const date = new Date().toISOString();
    const data = { id, title, date, messages };

    await redis.set(`conv:${id}`, data);

    const index = await redis.get("conv_index") || [];
    index.unshift({ id, title, date });
    await redis.set("conv_index", index);

    return Response.json({ success: true, id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
