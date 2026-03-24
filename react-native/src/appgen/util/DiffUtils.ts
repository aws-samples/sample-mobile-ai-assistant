// Placeholder for HTML code block - content is stored in message.htmlCode
export const HTML_CODE_PLACEHOLDER = '[HTML_OUTPUT_OMITTED]';

// Placeholder for diff code block - diff has been applied, no need to send again
export const DIFF_CODE_PLACEHOLDER = '[PREVIOUS_DIFF_APPLIED]';

// Global storage for latest HTML code in App mode
let latestHtmlCode: string = '';

/**
 * Get the latest HTML code
 */
export function getLatestHtmlCode(): string {
  return latestHtmlCode;
}

/**
 * Set the latest HTML code
 */
export function setLatestHtmlCode(htmlCode: string): void {
  latestHtmlCode = htmlCode;
}

/**
 * Clear the latest HTML code (call when starting new session or leaving App mode)
 */
export function clearLatestHtmlCode(): void {
  latestHtmlCode = '';
}

/**
 * Replace HTML code in text with placeholder
 */
export function replaceHtmlWithPlaceholder(
  text: string,
  htmlCode: string
): string {
  return text.replace(htmlCode, HTML_CODE_PLACEHOLDER);
}

/**
 * Replace diff code in text with placeholder
 */
export function replaceDiffWithPlaceholder(
  text: string,
  diffCode: string
): string {
  return text.replace(diffCode, DIFF_CODE_PLACEHOLDER);
}
