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
            content: `You are an infographic designer. Create a self-contained HTML infographic that visually summarizes the EXACT content of the document below.

STRICT RULES:
- The title, key points, and all text MUST come directly from the document content — do not invent generic content
- Extract the real title, main topics, and 3-5 most important specific points from the document
- Use only inline styles (no external CSS, no external fonts, no external resources)
- Design: colorful cards or sections, rounded corners, modern typography using system fonts
- The HTML must work inside an iframe with no external dependencies
- Output ONLY raw HTML — no markdown, no code fences, no explanation

DOCUMENT TO SUMMARIZE:
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
