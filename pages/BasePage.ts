import { type Page } from '@playwright/test';

/**
 * Base class for all Page Objects.
 *
 * Provides the single shared navigateTo() implementation so every page
 * does the same thing on load: go to URL, wait for networkidle.
 * Subclasses override the public navigateTo() with their specific path.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  protected async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }
}
