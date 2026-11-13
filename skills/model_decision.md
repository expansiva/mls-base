# Decision alias

`decision` picks an option index. It does not write text. Use it to validate or classify a case (for example a chat message) before calling a large chat model. The caller decides whether to call it.

The call from an agent inside collab-messages does not exist yet. That work belongs to the collabMessages queue. Do not invent a helper: until that queue ships one, the only contract is `POST /v1/decisions` on collab-llm, with the same authorization as chat.

Swapping the underlying model is an admin registration (`models.mode = 'decision'`). A new database is seeded with the alias `decision` (OpenRouter, `typesafe/jev-1.14`); in an existing environment the alias is registered in the admin, with the same fields. An alias with another `mode` is 404 `llm.model.alias_not_found` on this route. A provider with no decision adapter is 502 `llm.decision.provider_unsupported` and is not sent to chat.

## Contract

`state` is a string of valid JSON, shared by every question in the request. `questions` has at least one item and up to 300 questions per request (default of `collab-llm.decisions.maxQuestions`; raised in appconfig). A request above the ceiling is 400 `llm.decision.invalid_questions`, and the error text states the ceiling. Each `id` is unique and matches `[A-Za-z0-9_-]{1,64}`, `instructions` is non-empty, and `options` has 2 to 20 items (default of `maxOptions`; raised in appconfig).

A request larger than one part (10 questions per part, default of `partSize`; raised in appconfig) is still one HTTP call. collab-llm splits the questions in order, keeps the same `state` on every part, and runs up to 10 parts at once (default of `maxConcurrentParts`; raised in appconfig). Callers who send at most one part see the same success body as a single call, plus `blockId`.

Limits in production (all keys optional under `collab-llm.decisions` in appconfig; the value shown is the default):

| Key | Value | Meaning |
|---|---|---|
| `maxQuestions` | 300 | questions per request |
| `maxOptions` | 20 | options per question |
| `partSize` | 10 | questions per provider call |
| `maxConcurrentParts` | 10 | parts running at once |
| `partTimeoutMs` | 10000 | deadline of each part |
| `blockTimeoutMs` | 15000 | deadline of the whole request |

```json
{
  "model": "decision",
  "state": "{\"message\":\"cancela meu pedido 123\",\"channel\":\"chat\"}",
  "questions": [
    { "id": "intent", "instructions": "What does the user want?", "options": ["question", "command", "complaint", "other"] },
    { "id": "urgent", "instructions": "Is it urgent?", "options": ["no", "yes"] }
  ]
}
```

A 200 body keeps `answers` in the same order as `questions`. `requestId` and `blockId` are the same id for the whole request. `index` is the chosen option. `probabilities`, when the provider sends them, follows that same option order. `confidence` is the provider's own score; it is not the probability of the chosen option. `usage` sums the tokens of every part.

```json
{
  "requestId": "…",
  "blockId": "…",
  "model": "typesafe/jev-1.14-20261014",
  "answers": [
    { "id": "intent", "index": 1, "confidence": 1, "probabilities": [0, 1, 0, 0] },
    { "id": "urgent", "index": 0, "confidence": 0.32, "probabilities": [0.66, 0.34] }
  ],
  "usage": { "inputTokens": 399, "outputTokens": 73 }
}
```

A refusal is `{ "id": "…", "index": null, "refused": true }`. A `choice` outside the option list is returned the same way. The caller decides what a refusal means and what confidence is too low. This route does not apply a confidence cutoff.

When at least one part returns and another fails, the HTTP status stays 200 and the body sets `"partial": true`. Each question from a failed part is `{ "id", "index": null, "error": "timeout" | "provider" | "rate_limited" }`. Questions from parts that returned stay normal answers, in the original order. The request is an error only when every part fails; that error is the same status and code a single call would return (for example 504 `llm.decision.timeout`).

## Errors, time, cost

| Case | Result |
|---|---|
| `state` is not a string of valid JSON | 400 `llm.decision.invalid_state` |
| `questions` breaks the limits above | 400 `llm.decision.invalid_questions` (the text includes the ceiling) |
| No credit | 402, same gate as chat, checked once at the start |
| Alias missing, inactive, or not `mode = decision` | 404 `llm.model.alias_not_found` |
| Each part | Its own deadline (10 s, default of `partTimeoutMs`; raised in appconfig). A timeout, a 5xx, or a 429 retries once on `alternate_alias` when that alias is also `mode = decision` |
| The whole request | Its own deadline (15 s, default of `blockTimeoutMs`; raised in appconfig). Parts still running are cancelled and count as `timeout` |
| Every part fails | The error of that failure (504 `llm.decision.timeout` when the failure is a timeout) |
| Some parts fail | 200 with `partial: true` and `error` on those questions |
| Provider 400 | forwarded, no alternate |

Organization credit and the rate limiter run once, at the start of the request. Tokens from every part are counted against that limiter. Each part is billed on its own and writes its own `request_event`, all of them carrying the same `blockId`. Billing uses the provider-reported `usage.cost`, charged like chat (the OpenRouter fee the chat path already applies, times the organization commission). `usage` in the response is token counts only.

A part returns in about 0.4–0.7 s. A block of a few hundred questions, split and run together, returns in a few seconds. Cost is about US$ 0.00001 per question before commission. The part deadline and the block deadline stay well above that.
