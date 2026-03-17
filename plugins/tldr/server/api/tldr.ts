import Router from "koa-router";
import auth from "@server/middlewares/authentication";
import Logger from "@server/logging/Logger";
import { Document } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { authorize } from "@server/policies";
import type { APIContext } from "@server/types";

const router = new Router();

router.post("tldr.create", auth(), async (ctx: APIContext) => {
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

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Generate a concise TL;DR summary (2-4 sentences) for the following document. Write in the same language as the document. Return only the summary text, no preamble or labels.\n\n${markdown}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    Logger.error("OpenRouter API error", new Error(errorBody), { status: response.status });
    ctx.throw(502, `Error calling AI API: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  const summary = data.choices[0].message.content.trim();

  ctx.body = { data: { summary } };
});

export default router;
