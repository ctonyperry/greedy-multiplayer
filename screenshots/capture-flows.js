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
    fullPage: true,
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
      await addAIButton.scrollIntoViewIfNeeded();
      await addAIButton.click();
      await waitForStable(page);
      await screenshot(page, viewportName, '07-add-ai-form');

      // Submit AI player (name should be auto-filled)
      // Look for the submit button in the AI form
      const addButton = page.locator('button:has-text("Add")').last();
      await addButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      if (await addButton.isVisible()) {
        await addButton.click();
        await waitForStable(page);
        await page.waitForTimeout(1000); // Wait for AI to be added
        await screenshot(page, viewportName, '08-lobby-with-ai');
      } else {
        console.log('    ⚠ Add button not found');
      }
    } else {
      console.log('    ⚠ Add AI button not found');
    }

    // ==========================================
    // 6. START GAME
    // ==========================================
    console.log('6. Game Start');

    const startButton = page.getByRole('button', { name: /start game/i });
    if (await startButton.isVisible()) {
      await startButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await startButton.click();
      console.log('    ✓ Clicked Start Game');
      await waitForStable(page);
      await page.waitForTimeout(3000); // Wait for game to initialize
    } else {
      console.log('    ⚠ Start Game button not found - checking if game already started');
    }

    // ==========================================
    // 7. GAMEPLAY SCREENS - Play multiple rounds
    // ==========================================
    console.log('7. Gameplay (playing multiple rounds)');

    // Initial game state
    await waitForStable(page);
    await screenshot(page, viewportName, '09-game-initial');

    // Helper to select scoring dice (click on 1s and 5s preferably)
    async function selectScoringDice(page) {
      // Try to click on non-disabled, non-dimmed dice
      const dice = page.locator('button.die:not(.disabled):not(.dimmed):not(.selected)');
      const count = await dice.count();
      let selected = 0;

      for (let i = 0; i < count && selected < 3; i++) {
        try {
          const die = dice.nth(i);
          if (await die.isVisible() && await die.isEnabled()) {
            await die.click();
            selected++;
            await page.waitForTimeout(300);
          }
        } catch (e) {
          // Die might have become unavailable
        }
      }
      return selected;
    }

    // Helper to wait for our turn
    async function waitForOurTurn(page, maxWait = 15000) {
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        const rollButton = page.getByRole('button', { name: /^roll|roll \d/i });
        const riskButton = page.getByRole('button', { name: /risk it/i });

        const canRoll = await rollButton.isVisible().catch(() => false) &&
                       await rollButton.isEnabled().catch(() => false);
        const canRisk = await riskButton.isVisible().catch(() => false);

        if (canRoll || canRisk) {
          return true;
        }
        await page.waitForTimeout(500);
      }
      return false;
    }

    let screenshotNum = 10;
    let humanTurns = 0;
    let aiTurns = 0;
    const maxTotalTurns = 12;

    for (let turn = 0; turn < maxTotalTurns; turn++) {
      // Check for game over first
      const gameOver = page.locator('text=/game over/i');
      const winner = page.locator('text=/winner/i');

      if (await gameOver.isVisible().catch(() => false) ||
          await winner.isVisible().catch(() => false)) {
        await screenshot(page, viewportName, `${screenshotNum++}-game-over`);
        break;
      }

      // Check if it's our turn
      const rollButton = page.getByRole('button', { name: /^roll|roll \d/i });
      const riskButton = page.getByRole('button', { name: /risk it/i });

      const canRoll = await rollButton.isVisible().catch(() => false) &&
                     await rollButton.isEnabled().catch(() => false);
      const canRisk = await riskButton.isVisible().catch(() => false);

      if (canRoll || canRisk) {
        humanTurns++;
        console.log(`    Human turn ${humanTurns}...`);

        // Handle Risk It / Play Safe choice
        if (canRisk) {
          await screenshot(page, viewportName, `${screenshotNum++}-carryover-choice`);
          await riskButton.click();
          await page.waitForTimeout(1500);
          await screenshot(page, viewportName, `${screenshotNum++}-risk-it-roll`);
        } else {
          // Normal roll
          await rollButton.click();
          await page.waitForTimeout(1500);
          await screenshot(page, viewportName, `${screenshotNum++}-human-after-roll`);
        }

        // Select some dice
        const selected = await selectScoringDice(page);
        if (selected > 0) {
          await waitForStable(page);
          await screenshot(page, viewportName, `${screenshotNum++}-human-dice-selected`);
        }

        // Check for bank button
        const bankButton = page.getByRole('button', { name: /bank/i });
        const canBank = await bankButton.isVisible().catch(() => false) &&
                       await bankButton.isEnabled().catch(() => false);

        // Alternate between banking and rolling again
        if (canBank && humanTurns % 2 === 0) {
          await screenshot(page, viewportName, `${screenshotNum++}-human-bank-option`);
          await bankButton.click();
          await page.waitForTimeout(1000);
          await screenshot(page, viewportName, `${screenshotNum++}-human-after-bank`);
        } else {
          // Try to roll again
          const rollAgainButton = page.getByRole('button', { name: /^roll|roll \d/i });
          if (await rollAgainButton.isVisible().catch(() => false) &&
              await rollAgainButton.isEnabled().catch(() => false)) {
            await rollAgainButton.click();
            await page.waitForTimeout(1500);
            await screenshot(page, viewportName, `${screenshotNum++}-human-second-roll`);

            // Select more dice
            await selectScoringDice(page);
            await waitForStable(page);

            // Check for hot dice
            const hotDice = page.getByRole('button', { name: /hot dice/i });
            if (await hotDice.isVisible().catch(() => false)) {
              await screenshot(page, viewportName, `${screenshotNum++}-hot-dice`);
              await hotDice.click();
              await page.waitForTimeout(1500);
              await screenshot(page, viewportName, `${screenshotNum++}-hot-dice-roll`);
            }

            // Try to bank
            if (await bankButton.isVisible().catch(() => false) &&
                await bankButton.isEnabled().catch(() => false)) {
              await bankButton.click();
              await page.waitForTimeout(1000);
            }
          }
        }

        // Check for bust
        const bust = page.locator('text=/bust/i');
        if (await bust.isVisible().catch(() => false)) {
          await screenshot(page, viewportName, `${screenshotNum++}-human-bust`);
        }

      } else {
        // AI's turn - wait and capture
        aiTurns++;
        console.log(`    AI turn ${aiTurns}...`);

        await screenshot(page, viewportName, `${screenshotNum++}-ai-turn-${aiTurns}`);

        // Wait for AI to complete their turn
        await waitForOurTurn(page, 10000);
        await page.waitForTimeout(500);
      }

      await page.waitForTimeout(500);
    }

    // Final game state
    await waitForStable(page);
    await screenshot(page, viewportName, `${screenshotNum++}-final-state`);

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
