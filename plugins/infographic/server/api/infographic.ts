import Router from "koa-router";
import auth from "@server/middlewares/authentication";
import Logger from "@server/logging/Logger";
import { Document } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { authorize } from "@server/policies";
import type { APIContext } from "@server/types";

const router = new Router();

router.post("infographic.create", auth(), async (ctx: APIContext) => {
  const { id, text } = ctx.request.body as { id: string; text?: string };
  const { user } = ctx.state.auth;

  const document = await Document.findByPk(id, { userId: user.id });
  authorize(user, "read", document);

  // Prefer text sent from the client (live editor content) over DB-stored content
  const markdown = text?.trim()
    ? text
    : await DocumentHelper.toMarkdown(document!);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    ctx.throw(500, "OPENROUTER_API_KEY not configured");
  }

  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001";

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `You are an expert infographic designer. Transform the document below into a rich, detailed, visually compelling HTML infographic.

CRITICAL RULES — follow every one exactly:
1. LANGUAGE: Detect the language of the document and write ALL text in that SAME language. Never switch languages.
2. CONTENT: Extract real content from the document. Use the actual title, real section headings, real key ideas, real data, real conclusions. Do NOT invent or use generic placeholders.
3. STRUCTURE: Build a comprehensive infographic with ALL of these sections:
   - A prominent header with the document title and a one-sentence summary
   - 4 to 6 thematic sections, each with: a section title, 2-3 sentences of explanation, and 2-3 specific bullet points from the document
   - A "Conclusiones clave" (or equivalent in the document's language) section at the bottom summarizing 3 takeaways
4. STYLE: Inline CSS only. No external resources. Use system fonts (Arial, sans-serif). Use a consistent color palette: rich section headers, light card backgrounds, colored accent borders. Cards with rounded corners and subtle shadows. The infographic should be visually dense and informative, not minimal.
5. OUTPUT: Return raw HTML only. No markdown fences, no \`\`\`html, no explanation text.

DOCUMENT:
${markdown}`,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    Logger.error("OpenRouter API error", new Error(errorBody), {
      status: response.status,
    });
    ctx.throw(502, `Error calling AI API: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  let html = data.choices[0].message.content.trim();
  // Strip markdown code fences if the model wraps the output
  html = html.replace(/^```html?\s*/i, "").replace(/\s*```$/, "");

  ctx.body = { data: { html } };
});

export default router;
