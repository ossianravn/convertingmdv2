export const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

export function requestHeaders(requestId: string): Headers {
  return new Headers({ "X-Converting-Request-Id": requestId });
}

