/**
 * Playwright Screenshot Capture for UX Analysis
 * Captures all user flows in both mobile and desktop viewports
 *
 * Usage: npm run capture
 * Output: ./output/desktop/*.png, ./output/mobile/*.png
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuration
const BASE_URL = process.env.BASE_URL || 'https://getgreedy.io';
const OUTPUT_DIR = path.join(__dirname, 'output');

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }, // iPhone 14 Pro
};

// Helper to ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper to take screenshot with consistent naming
async function screenshot(page, viewport, name) {
  const dir = path.join(OUTPUT_DIR, viewport);
  ensureDir(dir);
  const filename = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
  await page.screenshot({
    path: path.join(dir, filename),
    fullPage: false,
  });
  console.log(`  ✓ ${viewport}/${filename}`);
}

// Wait for network to be idle and animations to settle
async function waitForStable(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500); // Let animations settle
}

// Generate a random guest name for the session
function generateGuestName() {
  const adjectives = ['Lucky', 'Swift', 'Bold', 'Clever'];
  const nouns = ['Fox', 'Tiger', 'Eagle', 'Wolf'];
  return adjectives[Math.floor(Math.random() * adjectives.length)] +
         nouns[Math.floor(Math.random() * nouns.length)];
}

/**
 * Capture all user flows for a given viewport
 */
async function captureFlows(browser, viewportName, viewportSize) {
  console.log(`\n📸 Capturing ${viewportName} screenshots (${viewportSize.width}x${viewportSize.height})...\n`);

  const context = await browser.newContext({
    viewport: viewportSize,
    deviceScaleFactor: 2, // Retina quality
  });

  const page = await context.newPage();
  const guestName = generateGuestName();

  try {
    // ==========================================
    // 1. START/AUTH SCREEN
    // ==========================================
    console.log('1. Auth Screen');
    await page.goto(BASE_URL);
    await waitForStable(page);
    await screenshot(page, viewportName, '01-auth-screen');

    // ==========================================
    // 2. GUEST LOGIN FLOW
    // ==========================================
    console.log('2. Guest Login');

    // Click "Continue as Guest"
    const guestButton = page.getByRole('button', { name: /guest/i });
    if (await guestButton.isVisible()) {
      await guestButton.click();
      await waitForStable(page);
      await screenshot(page, viewportName, '02-guest-name-input');

      // Enter guest name
      const nameInput = page.getByPlaceholder(/name/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill(guestName);
        await screenshot(page, viewportName, '03-guest-name-filled');

        // Submit - be more specific
        const continueBtn = page.getByRole('button', { name: 'Start Playing' });
        if (await continueBtn.isVisible()) {
          await continueBtn.click();
          await waitForStable(page);
        }
      }
    }

    // ==========================================
    // 3. HOME SCREEN
    // ==========================================
    console.log('3. Home Screen');
    await waitForStable(page);
    await screenshot(page, viewportName, '04-home-screen');

    // ==========================================
    // 4. CREATE GAME FLOW
    // ==========================================
    console.log('4. Create Game Flow');

    const createButton = page.getByRole('button', { name: /create game/i });
    if (await createButton.isVisible()) {
      await createButton.click();
      await waitForStable(page);
      await screenshot(page, viewportName, '05-create-game-settings');

      // Create the game
      const createSubmit = page.getByRole('button', { name: /create|start/i }).last();
      if (await createSubmit.isVisible()) {
        await createSubmit.click();
        await waitForStable(page);
      }
    }

    // ==========================================
    // 5. GAME LOBBY
    // ==========================================
    console.log('5. Game Lobby');
    await waitForStable(page);
    await page.waitForTimeout(1000); // Wait for lobby to load
    await screenshot(page, viewportName, '06-game-lobby-empty');

    // Add AI player
    const addAIButton = page.getByRole('button', { name: /add ai/i });
    if (await addAIButton.isVisible()) {
      await addAIButton.click();
      await waitForStable(page);
      await screenshot(page, viewportName, '07-add-ai-form');

      // Submit AI player (name should be auto-filled)
      const addButton = page.getByRole('button', { name: /^add$/i });
      if (await addButton.isVisible()) {
        await addButton.click();
        await waitForStable(page);
        await screenshot(page, viewportName, '08-lobby-with-ai');
      }
    }

    // ==========================================
    // 6. START GAME
    // ==========================================
    console.log('6. Game Start');

    const startButton = page.getByRole('button', { name: /start game/i });
    if (await startButton.isVisible()) {
      await startButton.click();
      await waitForStable(page);
      await page.waitForTimeout(2000); // Wait for game to initialize
    }

    // ==========================================
    // 7. GAMEPLAY SCREENS
    // ==========================================
    console.log('7. Gameplay');

    // Initial game state
    await waitForStable(page);
    await screenshot(page, viewportName, '09-game-initial');

    // Try to capture various game states
    // Roll dice if it's our turn
    const rollButton = page.getByRole('button', { name: /roll/i });
    if (await rollButton.isVisible() && await rollButton.isEnabled()) {
      await rollButton.click();
      await page.waitForTimeout(1500); // Wait for roll animation
      await screenshot(page, viewportName, '10-after-roll');

      // Try to select a die
      const dice = page.locator('.die:not(.disabled):not(.dimmed)');
      const diceCount = await dice.count();
      if (diceCount > 0) {
        await dice.first().click();
        await waitForStable(page);
        await screenshot(page, viewportName, '11-die-selected');

        // Check for bank button
        const bankButton = page.getByRole('button', { name: /bank/i });
        if (await bankButton.isVisible()) {
          await screenshot(page, viewportName, '12-bank-option');
        }

        // Roll again
        if (await rollButton.isVisible() && await rollButton.isEnabled()) {
          await rollButton.click();
          await page.waitForTimeout(1500);
          await screenshot(page, viewportName, '13-second-roll');
        }
      }
    }

    // Wait for AI turn if applicable
    await page.waitForTimeout(3000);
    await screenshot(page, viewportName, '14-ai-turn');

    // ==========================================
    // 8. HELP PANEL
    // ==========================================
    console.log('8. Help Panel');

    // Go back to capture help from home
    await page.goto(BASE_URL);
    await waitForStable(page);

    const helpButton = page.getByRole('button', { name: /help|\?/i });
    if (await helpButton.isVisible()) {
      await helpButton.click();
      await waitForStable(page);
      await screenshot(page, viewportName, '15-help-panel');

      // Close help
      const closeButton = page.getByRole('button', { name: /close|×|x/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await waitForStable(page);
      }
    }

    // ==========================================
    // 9. JOIN GAME FLOW
    // ==========================================
    console.log('9. Join Game Flow');

    const joinButton = page.getByRole('button', { name: /join game/i });
    if (await joinButton.isVisible()) {
      await joinButton.click();
      await waitForStable(page);
      await screenshot(page, viewportName, '16-join-game');
    }

  } catch (error) {
    console.error(`  ✗ Error during ${viewportName} capture:`, error.message);
  } finally {
    await context.close();
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🎲 Greedy Dice - UX Screenshot Capture');
  console.log('=====================================');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // Capture both viewports
    await captureFlows(browser, 'desktop', VIEWPORTS.desktop);
    await captureFlows(browser, 'mobile', VIEWPORTS.mobile);

    console.log('\n=====================================');
    console.log('✅ Screenshot capture complete!');
    console.log(`📁 Output: ${OUTPUT_DIR}`);

    // List captured files
    for (const viewport of ['desktop', 'mobile']) {
      const dir = path.join(OUTPUT_DIR, viewport);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log(`\n${viewport}: ${files.length} screenshots`);
      }
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
