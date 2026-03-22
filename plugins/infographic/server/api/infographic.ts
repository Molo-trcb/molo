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

  Logger.info("infographic", `Document markdown length: ${markdown.length}, preview: ${markdown.slice(0, 200)}`);

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
            content: `You are an expert infographic designer. Your task is to convert the document below into a rich, detailed HTML infographic that faithfully represents the document's actual content.

STRICT RULES:
1. LANGUAGE: Use the exact same language as the document throughout. If the document is in Spanish, all text must be in Spanish.
2. STRUCTURE: Create one section card for each major section or heading found in the document. Use the document's exact heading text as the card title — do not rename or merge sections. Include specific details, phrases, and bullet points taken directly from each section.
3. LAYOUT:
   - A prominent header showing the document's actual title and a one-sentence summary of the whole document
   - One card per document section (preserve the document's order), each containing: exact section title, 2-3 sentences from that section, and 2-3 of its bullet points
   - A final conclusions card in the document's language summarizing the main takeaways
4. STYLE: Inline CSS only. No external resources. System fonts (Arial, sans-serif). Each card has a colored header bar, white background, left border accent, rounded corners, box-shadow. Use a rich consistent color palette.
5. OUTPUT: Return only the raw HTML. No markdown, no \`\`\`html, no explanatory text outside the HTML.

DOCUMENT TO CONVERT:
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
