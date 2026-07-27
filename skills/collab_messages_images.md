# Skill: collab-messages image generation

Use this when an agent needs to create image assets from collab-messages.

## Recommended path: agent step in collab-messages

Agents do not call `collab-llm` directly. The agent creates a normal collab-messages LLM step
(`prompt_ready`, usually from `beforePromptStep`) and asks for an image with `resultType: image`.

`resultType` decides the response kind and endpoint. `modelType` remains the model alias configured
in the `collab-llm` database, so it can be any active image-generation alias.

The system prompt should contain only the routing comment and concise instructions:

```txt
<!-- resultType: image -->
<!-- modelType: image -->
<!-- size: 1024x1024 -->
<!-- quality: low -->
Create a realistic square product photo of a compact cashier counter for a small cafe.
White background. Front view. No text, no watermark, no logo. High detail. 1024x1024.
```

'size' and 'quality' are optional.
`size` and `quality` are passed to the image provider when supported; providers that do not support
them may ignore or reject them.

`collab-messages` detects `resultType: image` and internally calls the `collab-llm` image endpoint
using `modelType` as the alias. The LLM step result is a normal flexible payload:

```json
{
  "type": "flexible",
  "result": {
    "dataUrl": "https://...",
    "mimeType": "image/png"
  }
}
```

Then `afterPromptStep` should read `step.interaction.payload[0].result.dataUrl` and persist or map it
to the business artifact.
The image repository is temporary, some days.

For multiple images, do not ask the image model to plan JSON. Use a normal chat/code step first to
produce the list of assets, then create one image step per asset.

Notes:

- `size` accepts `1024x1024`, `1024x1536`, or `1536x1024` in the OpenAI direct path.
- `quality` accepts `low`, `medium`, or `high` in the OpenAI direct path.
- Gemini direct image generation ignores those OpenAI-specific comments.
- Do not expect JSON from these image calls; the image result is a flexible payload.

## Why `resultType: image` matters — the INVALID_JSON_CONTENT failure

Image-generation models (`only_image: true`, `mode: "image_generation"`) return
`choices[0].message.content = null` — the image is delivered out-of-band (base64 / an image URL),
never as JSON text. If such a request is sent to `/v1/chat/completions` **with** `x-ensure-json`
(the default for most agent steps), the strict JSON validator sees `content: null` and rejects it as
`INVALID_JSON_CONTENT`. That is exactly what killed a backend run at its final step
(`agentCbSeedAssets`, erro4_er1: alias `image` → openrouter/gemini-3.1-flash-image, `finish_reason:
stop`, `image_tokens: 1120` — the model **succeeded**, the proxy just couldn't parse a null content).

Two guards prevent a repeat:

1. **Routing (collab-messages):** `resultType: image` makes collab-messages call
   `POST /v1/images/generations` instead of `/v1/chat/completions`, so ensure-json never runs on an
   image response. This is the real fix — always set `resultType: image` for image steps.
2. **Proxy guard (collab-llm):** an `image_generation` alias sent to `/v1/chat/completions` now throws
   a clear `IMAGE_ENDPOINT_REQUIRED` (with the correct-endpoint remediation) instead of the opaque
   `INVALID_JSON_CONTENT`. A misrouted caller gets an actionable error, not a mystery.

## Graceful degradation — an image failure must never fail the run

Seed images are cosmetic. `agentCbSeedAssets` treats every image failure as non-blocking: the failed
asset is recorded as a `failed` manifest entry (its seed value stays `null`, surfaced as a warning),
and the step still routes to `cb-register`. The seed-asset steps are enqueued `onFailure: 'continue'`
so `afterPromptStep` runs even when the proxy call itself errors (no payload). Net effect: an optional
asset can never mark the whole backend run `failed`. (Covered by `seedAssetsCore.test.ts` — "seeds
intactos".)

**Known unverified path:** the openrouter image branch (`callOpenRouterImages` →
`https://openrouter.ai/api/v1/images`) has NOT been verified end-to-end from this environment; that
endpoint's shape is uncertain. Prefer the `gemini`/`openai` image aliases (direct provider paths,
verified) until the openrouter route is confirmed against a live call.

