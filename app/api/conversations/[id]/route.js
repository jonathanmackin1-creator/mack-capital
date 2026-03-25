import { readFileSync } from "fs";
import { join } from "path";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const path = join(process.cwd(), "conversations", `${id}.json`);
    const data = JSON.parse(readFileSync(path, "utf8"));
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
