import { Page } from 'playwright';
import { config } from '../../config';

export interface CreateProjectResult {
  projectId: string;
  projectUrl: string;
  success: boolean;
  message: string;
}

/**
 * Extract project UUID from Google Flow project URL
 * Example URL: https://labs.google/fx/id/tools/flow/project/10ab715a-31e2-48d3-9e56-840e8af6c062
 */
export function extractProjectIdFromUrl(url: string): string | null {
  const match = url.match(/\/project\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i) ||
                url.match(/\/project\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Action: Navigates to Google Flow tools page and creates/opens a new project, extracting its UUID.
 */
export async function createFlowProjectAction(
  page: Page,
  flowUrl: string = config.flowUrl
): Promise<CreateProjectResult> {
  console.log(`[Playwright Action] Navigating to Google Flow tool: ${flowUrl}`);

  await page.goto(flowUrl, { waitUntil: 'domcontentloaded', timeout: config.defaultTimeout });
  await page.waitForTimeout(3000);

  let currentUrl = page.url();
  let projectId = extractProjectIdFromUrl(currentUrl);

  // If already redirected to a project page with UUID
  if (projectId) {
    console.log(`[Playwright Action] Auto-redirected to project: ${projectId}`);
    return {
      success: true,
      projectId,
      projectUrl: currentUrl,
      message: `Project created/loaded with ID: ${projectId}`,
    };
  }

  // If not automatically redirected, search for "Create Project" / "Buat Proyek" / "+" button
  console.log('[Playwright Action] Looking for create project button or link...');

  const createButtonSelectors = [
    'button:has-text("Buat Proyek")',
    'button:has-text("New Project")',
    'button:has-text("Buat")',
    'button:has-text("Create")',
    'a[href*="/project/"]',
    'button[aria-label*="Proyek"]',
    'button[aria-label*="Project"]',
    'button:has-text("+")',
  ];

  let clicked = false;
  for (const selector of createButtonSelectors) {
    try {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        console.log(`[Playwright Action] Clicking create project element: ${selector}`);
        await el.click();
        clicked = true;
        break;
      }
    } catch (_) {}
  }

  // Wait for navigation to /project/<uuid>
  try {
    console.log('[Playwright Action] Waiting for navigation to project page...');
    await page.waitForURL(/\/project\//, { timeout: 15000 });
  } catch (_) {
    console.log('[Playwright Action] Timeout waiting for URL change, checking current URL...');
  }

  currentUrl = page.url();
  projectId = extractProjectIdFromUrl(currentUrl);

  if (projectId) {
    console.log(`[Playwright Action] Successfully extracted Project UUID: ${projectId}`);
    return {
      success: true,
      projectId,
      projectUrl: currentUrl,
      message: `Project created successfully. UUID: ${projectId}`,
    };
  }

  return {
    success: false,
    projectId: '',
    projectUrl: currentUrl,
    message: `Failed to extract Project UUID from URL: ${currentUrl}`,
  };
}
