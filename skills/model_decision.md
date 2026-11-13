# Decision alias

`decision` picks an option index. It does not write text. Use it to validate or classify a case (for example a chat message) before calling a large chat model. The caller decides whether to call it.

The call from an agent inside collab-messages does not exist yet. That work belongs to the collabMessages queue. Do not invent a helper: until that queue ships one, the only contract is `POST /v1/decisions` on collab-llm, with the same authorization as chat.

Swapping the underlying model is an admin registration (`models.mode = 'decision'`). A new database is seeded with the alias `decision` (OpenRouter, `typesafe/jev-1.14`, measured 13/11/2026); in an existing environment the alias is registered in the admin, with the same fields. An alias with another `mode` is 404 `llm.model.alias_not_found` on this route. A provider with no decision adapter is 502 `llm.decision.provider_unsupported` and is not sent to chat.

## Contract

`state` is a string of valid JSON. `questions` is 1 to 10 items. Each `id` is unique and matches `[A-Za-z0-9_-]{1,64}`, `instructions` is non-empty, and `options` has 2 to 20 strings.

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

A 200 body keeps `answers` in the same order as `questions`. `index` is the chosen option. `probabilities`, when the provider sends them, follows that same option order. `confidence` is the provider's own score; it is not the probability of the chosen option.

```json
{
  "requestId": "…",
  "model": "typesafe/jev-1.14-20261014",
  "answers": [
    { "id": "intent", "index": 1, "confidence": 1, "probabilities": [0, 1, 0, 0] },
    { "id": "urgent", "index": 0, "confidence": 0.32, "probabilities": [0.66, 0.34] }
  ],
  "usage": { "inputTokens": 399, "outputTokens": 73 }
}
```

A refusal is `{ "id": "…", "index": null, "refused": true }`. A `choice` outside the option list is returned the same way. The caller decides what a refusal means and what confidence is too low. This route does not apply a confidence cutoff.

## Errors, time, cost

| Case | Result |
|---|---|
| `state` is not a string of valid JSON | 400 `llm.decision.invalid_state` |
| `questions` breaks the limits above | 400 `llm.decision.invalid_questions` |
| No credit | 402, same gate as chat |
| Alias missing, inactive, or not `mode = decision` | 404 `llm.model.alias_not_found` |
| Each attempt | 10 s. A timeout or a 5xx retries once on `alternate_alias` when that alias is also `mode = decision` |
| Both attempts time out | 504 `llm.decision.timeout` |
| Provider 400 | forwarded, no alternate |

Billing uses the provider-reported `usage.cost`, charged like chat (the OpenRouter fee the chat path already applies, times the organization commission). `usage` in the response is token counts only. A success and a failure both write a `request_event` under the alias that was called.

Measured on `typesafe/jev-1.14` (13/11/2026): two questions in one call returned in about 300–370 ms and cost about US$ 0.000017 before commission. One cold call took 695 ms. The 10 s limit held.
