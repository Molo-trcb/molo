import Router from "koa-router";
import auth from "@server/middlewares/authentication";
import Logger from "@server/logging/Logger";
import { Document } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { authorize } from "@server/policies";
import type { APIContext } from "@server/types";

const router = new Router();

router.post("infographic.create", auth(), async (ctx: APIContext) => {
  const { id } = ctx.request.body as { id: string };
  const { user } = ctx.state.auth;

  const document = await Document.findByPk(id, { userId: user.id });
  authorize(user, "read", document);

  const markdown = await DocumentHelper.toMarkdown(document!);

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
            content: `You are an expert infographic designer. Transform the following document into a beautiful, detailed HTML infographic.

RULES:
1. LANGUAGE: Write everything in the same language as the document. Never use English if the document is in another language.
2. CONTENT: Base the infographic entirely on the document below. Use its actual title, its real section headings, and the specific ideas, facts, and conclusions it contains. Do not invent content, but you may synthesize and summarize what is written.
3. STRUCTURE:
   - A header with the document's title and a brief intro sentence summarizing the document
   - 4 to 6 section cards, one per major topic in the document, each with: the topic title, 2-3 explanatory sentences, and 2-3 bullet points
   - A final "Conclusiones clave" card (translated to the document's language) with 3 takeaways from the document
4. STYLE: Inline CSS only. No external resources. System fonts (Arial, sans-serif). Colorful section headers, light card backgrounds, colored left borders or rounded corners, subtle box-shadows. Dense and informative layout.
5. OUTPUT: Return only raw HTML. No markdown fences, no \`\`\`html, no extra text.

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
