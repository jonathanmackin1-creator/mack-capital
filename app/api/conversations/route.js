import { writeFileSync, readFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "conversations");

function ensureDir() {
  try { mkdirSync(DIR, { recursive: true }); } catch {}
}

export async function GET() {
  ensureDir();
  try {
    const files = readdirSync(DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const data = JSON.parse(readFileSync(join(DIR, f), "utf8"));
        return { id: f.replace(".json", ""), title: data.title, date: data.date };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return Response.json({ conversations: files });
  } catch {
    return Response.json({ conversations: [] });
  }
}

export async function POST(request) {
  ensureDir();
  try {
    const { messages } = await request.json();
    const id = Date.now().toString();
    const firstUserMsg = messages.find(m => m.role === "user")?.content || "Conversation";
    const title = firstUserMsg.slice(0, 50);
    const data = { id, title, date: new Date().toISOString(), messages };
    writeFileSync(join(DIR, `${id}.json`), JSON.stringify(data, null, 2));
    return Response.json({ success: true, id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}