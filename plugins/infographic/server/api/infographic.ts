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

  const markdown = DocumentHelper.toMarkdown(document!);

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
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `Create a self-contained HTML infographic for the following document. Requirements:
- Use only inline styles (no external CSS, no external fonts, no external resources)
- Include: a prominent title, 3-5 key points as visual cards or bullets, a clean modern design with colors
- Make it visually appealing with background colors, rounded corners, and good typography
- The HTML must render correctly inside an iframe without any external dependencies
- Return ONLY the HTML code, nothing else, no markdown fences

Document:
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
  const html = data.choices[0].message.content.trim();

  ctx.body = { data: { html } };
});

export default router;
