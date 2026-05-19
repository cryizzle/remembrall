import { z } from "zod";

import { env, isPoolsideConfigured } from "./env.js";

type PoolsideChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type PoolsideChatCompletionRequest = {
  messages: PoolsideChatMessage[];
  temperature?: number;
  max_completion_tokens?: number;
  response_format?: {
    type: "json_object";
  };
};

type PoolsideChatCompletionResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
  }>;
};

export class PoolsideConfigurationError extends Error {
  constructor() {
    super("Poolside is not fully configured. Expected POOLSIDE_API_KEY, POOLSIDE_BASE_URL, and POOLSIDE_MODEL.");
  }
}

export class PoolsideRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Poolside request failed with status ${status}.`);
  }
}

export const parsedReminderActionSchema = z
  .object({
    reminder_id: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).nullable().optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
    clarification: z.string().trim().min(1).max(500).optional(),
    clairifcation: z.string().trim().min(1).max(500).optional(),
  })
  .transform(({ clairifcation, ...rest }) => ({
    ...rest,
    clarification: rest.clarification ?? clairifcation,
  }));

export type ParsedReminderAction = z.infer<typeof parsedReminderActionSchema>;

export async function createPoolsideChatCompletion(
  request: PoolsideChatCompletionRequest,
) {
  if (!isPoolsideConfigured()) {
    throw new PoolsideConfigurationError();
  }

  const response = await fetch(`${env.POOLSIDE_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.POOLSIDE_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.POOLSIDE_MODEL,
      ...request,
    }),
  });

  if (!response.ok) {
    throw new PoolsideRequestError(response.status, await response.text());
  }

  return (await response.json()) as PoolsideChatCompletionResponse;
}

export async function generateStructuredReminderAction(input: string, options?: {
  timezone?: string;
  nowIso?: string;
  reminderId?: string;
  currentReminderJson?: string;
  allowClarification?: boolean;
}) {
  const response = await createPoolsideChatCompletion({
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          [
            options?.reminderId
              ? "Update the existing reminder using the user's instruction."
              : "Extract exactly one reminder creation request from the user's text.",
            "Return strict JSON only.",
            "Use this schema exactly:",
            "{\"reminder_id\":\"string (optional)\",\"title\":\"string\",\"notes\":\"string|null\",\"dueAt\":\"ISO-8601 datetime with timezone offset|null\",\"clarification\":\"string (optional)\"}",
            options?.reminderId
              ? `Set reminder_id to ${options.reminderId}.`
              : "Do not include reminder_id when creating a new reminder.",
            options?.allowClarification === false
              ? "Do not ask a clarification question. You must return a final upsert-ready reminder payload."
              : "If the user has not provided enough information, ask exactly one clarification question using the clarification field. Prefer asking over guessing for ambiguous scheduled reminders.",
            options?.allowClarification === false
              ? "Choose a reasonable best-effort interpretation when some detail is still missing."
              : [
                  "Do not guess when the reminder clearly depends on a missing date, time, or other essential scheduling detail.",
                  "If a reminder sounds like a scheduled event, social plan, appointment, meeting, call, meal, or travel plan, and the exact time is missing, you MUST ask a clarification question instead of guessing.",
                  "If the date itself is ambiguous, you MUST ask a clarification question instead of guessing.",
                  "Examples that MUST trigger clarification: 'dinner tomorrow', 'call mom next week', 'meeting Friday', 'lunch with Sarah tomorrow', 'airport run Sunday'.",
                  "Examples that do not need clarification: 'bring charger tomorrow morning' if you can map morning to a reasonable time, 'pay rent on Friday' if a day is enough for the reminder.",
                  "When asking a clarification question, keep it to one short direct question.",
                  "When asking a clarification question, set dueAt to null unless the user already gave enough timing information for a confident datetime.",
                  "If there is any doubt between guessing and asking, ask.",
                ].join(" "),
            "Do not include markdown fences or extra keys.",
            options?.timezone ? `Assume the user's timezone is ${options.timezone}.` : undefined,
            options?.nowIso ? `The current datetime for interpretation is ${options.nowIso}.` : undefined,
            options?.currentReminderJson ? `Current reminder JSON: ${options.currentReminderJson}` : undefined,
          ].filter(Boolean).join(" "),
      },
      {
        role: "user",
        content: input,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content ?? null;
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as unknown;
  return parsedReminderActionSchema.parse(parsed);
}
