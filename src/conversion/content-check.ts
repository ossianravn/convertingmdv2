import type { ContentCheckConfig } from "../config";
import { askChoice, type ChoiceQuestion } from "../typesafe/system-one";

// Jev judges what a conversion actually received. A source can answer 200 and
// still be a firewall challenge, an app shell, a cookie wall, a soft 404 or a
// paywall; phrase lists miss these across languages and vendors.
export type PageOutcome =
  | "real_content"
  | "access_block"
  | "javascript_shell"
  | "consent_wall"
  | "not_found"
  | "login_wall";

export interface ContentCheck {
  outcome: PageOutcome;
  probability: number;
  model: string;
}

// The opening shows what the page is; longer input only adds cost.
const contentChars = 5000;

const question: ChoiceQuestion<PageOutcome> = {
  instructions:
    "A converter fetched `page.requested_url` and turned the response into Markdown. `page.content` is the start of that Markdown and `page.http_status` the status the source answered with. What did the converter actually receive?",
  criteria: {
    real_content:
      "The requested page itself: an article, product, category, listing, documentation, homepage or other real content, even if it is short or is about bots, CAPTCHAs or security.",
    access_block:
      "An anti-bot, firewall, browser-check, CAPTCHA, rate-limit or access-denied page shown instead of the requested page.",
    javascript_shell: "A loading screen or app shell without the page's content, such as a request to enable JavaScript.",
    consent_wall: "Only a cookie or consent notice, without the page's content.",
    not_found: "A not-found, error or maintenance page instead of the requested content.",
    login_wall: "A sign-in, subscription or paywall page that hides the requested content."
  }
};

export async function checkPageContent(
  config: ContentCheckConfig,
  page: { url: string; markdown: string; sourceStatus: number | null }
): Promise<ContentCheck> {
  const state = {
    page: {
      requested_url: page.url,
      http_status: page.sourceStatus ?? "unknown",
      content: page.markdown.slice(0, contentChars)
    }
  };
  const answer = await askChoice(config.typesafeApiKey, config.model, state, question);
  return { outcome: answer.choice, probability: answer.probabilities[answer.choice], model: answer.model };
}
