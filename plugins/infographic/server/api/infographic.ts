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
            content: `You are an expert infographic designer. Your ONLY job is to visually represent the exact content of the document below. You are a designer, not a writer — you do not add, invent, or improve content.

ABSOLUTE RULES:
1. LANGUAGE: Use the exact same language as the document. Never switch to English or any other language.
2. CONTENT FIDELITY: Every title, heading, and sentence in the infographic must be a direct quote or close paraphrase of text that actually appears in the document. If a section heading is not in the document, do not use it. If a bullet point is not in the document, do not write it. Do not add facts, tips, or ideas from your own knowledge.
3. STRUCTURE: Build the infographic with these sections in order:
   - Header: the document's actual title + one sentence taken verbatim or near-verbatim from the document
   - One section card per major section/heading found in the document (4-6 cards), each containing: the section's real title, 2-3 sentences copied or closely paraphrased from that section, and 2-3 bullet points that appear in that section
   - A closing card titled with the word for "Key Conclusions" in the document's language, listing 3 conclusions stated in the document
4. STYLE: Inline CSS only. No external resources. System fonts (Arial, sans-serif). Consistent color palette with colored section headers, light card backgrounds, accent borders. Rounded corners, subtle shadows. Visually dense.
5. OUTPUT: Raw HTML only. No markdown fences, no \`\`\`html, no text before or after the HTML.

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
