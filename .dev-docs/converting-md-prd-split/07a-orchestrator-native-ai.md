# 07A — Orchestrator, Native Markdown, and Workers AI
## Conversion orchestrator

Implement:

```txt
src/conversion/orchestrator.ts
src/conversion/result.ts
src/conversion/quality.ts
```

Pseudo-code:

```ts
async function convertMarkdown(input, context): Promise<ConversionResult> {
  const normalizedUrl = validateAndNormalizeUrl(input.url);

  const cached = await cache.get(normalizedUrl, input.options);
  if (cached && input.cache.read) return cached;

  if (input.mode === "native" || input.mode === "auto") {
    const native = await tryNativeMarkdown(normalizedUrl, context);
    if (native.ok) return writeCacheAndReturn(native);
    if (input.mode === "native") throw native.error;
  }

  if (input.mode === "ai" || input.mode === "auto") {
    const ai = await tryAiMarkdown(normalizedUrl, input, context);
    if (ai.ok && isGoodEnough(ai)) return writeCacheAndReturn(ai);

    if (
      input.mode === "auto" &&
      input.browser.enabled &&
      context.apiKey.allowBrowser &&
      context.apiKey.autoBrowserFallback
    ) {
      const browser = await tryBrowserMarkdown(normalizedUrl, input, context);
      if (browser.ok) return writeCacheAndReturn(browser);
    }

    if (ai.ok) return writeCacheAndReturn(ai);
    throw ai.error;
  }

  if (input.mode === "browser") {
    const browser = await tryBrowserMarkdown(normalizedUrl, input, context);
    if (browser.ok) return writeCacheAndReturn(browser);
    throw browser.error;
  }

  throw new Error("Unsupported mode");
}
```

## Mode behavior

```txt
mode=native only tries native.
mode=ai only tries AI.
mode=browser only tries browser.
mode=auto tries native then AI.
mode=auto does not use browser unless request and key allow it.
Failed native can fall back to AI.
Failed or weak AI can fall back to browser only when allowed.
```

## Native Markdown strategy

File:

```txt
src/conversion/native.ts
```

Behavior:

```txt
Fetch target URL with Accept: text/markdown.
Do not exceed MAX_SOURCE_BYTES.
Do not follow more than 5 redirects.
Do not follow redirects to blocked URLs.
Return success only if response content-type is text/markdown or body looks strongly like Markdown.
Capture x-markdown-tokens if present.
```

Headers:

```http
Accept: text/markdown
User-Agent: converting.md/0.1
```

Return metadata:

```txt
method=native
sourceContentType
statusCode
tokens
inputBytes
outputBytes
```

Native acceptance criteria:

```txt
Native Markdown response returns method=native.
HTML response does not count as successful native conversion.
Large response returns source_too_large.
Redirect to blocked URL is rejected.
```

## Workers AI strategy

File:

```txt
src/conversion/ai.ts
```

Behavior:

```txt
Fetch target URL normally.
Inspect content-type.
Reject image content unless key allows image conversion.
Reject unsupported content types.
Create Blob from limited response body.
Call env.AI.toMarkdown().
Pass conversionOptions for HTML hostname/cssSelector.
Pass image conversion options only when image conversion is allowed.
Return Markdown data and token count when available.
```

HTML conversion options:

```ts
{
  conversionOptions: {
    html: {
      hostname: new URL(url).hostname,
      cssSelector: input.ai.cssSelector
    }
  }
}
```

Image conversion options only when allowed:

```ts
{
  conversionOptions: {
    image: {
      descriptionLanguage: input.ai.imageDescriptionLanguage ?? "en"
    }
  }
}
```

Do not attempt to manually parse the article body in v1.

AI acceptance criteria:

```txt
HTML source converts through mocked AI binding.
cssSelector is passed through.
Image URL is blocked by default.
Image URL succeeds only with allow_images=true and quota available.
AI token count is included when available.
```
