// True when the Accept header explicitly asks for HTML. Wildcards do not count,
// so curl (`*/*`) and API clients keep receiving JSON.
export function acceptsHtml(accept: string | undefined): boolean {
  if (!accept) return false;

  return accept.split(",").some((range) => {
    const [mediaType = "", ...params] = range.split(";").map((part) => part.trim().toLowerCase());
    return mediaType === "text/html" && !params.some(isZeroQuality);
  });
}

function isZeroQuality(param: string): boolean {
  const match = /^q=([\d.]+)$/.exec(param);
  return match !== null && Number(match[1]) === 0;
}
