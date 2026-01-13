/**
 * Mobile UX Audit - Captures mobile screenshots for analysis
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://getgreedy.io';
const OUTPUT_DIR = path.join(__dirname, 'mobile-audit');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function screenshot(page, name) {
  ensureDir(OUTPUT_DIR);
  const filename = `${name}.png`;
  await page.screenshot({
    path: path.join(OUTPUT_DIR, filename),
    fullPage: true,
  });
  console.log(`  ✓ ${filename}`);
}

async function main() {
  console.log('📱 Mobile UX Audit\n');

  // Clean output
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // Use iPhone 14 device profile
  const context = await browser.newContext({
    ...devices['iPhone 14'],
  });

  const page = await context.newPage();

  try {
    // 1. Start/Auth Screen
    console.log('1. Auth Screen');
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    await screenshot(page, '01-auth-screen');

    // 2. Guest Login Flow
    console.log('2. Guest Login');
    await page.getByRole('button', { name: /guest/i }).click();
    await page.waitForTimeout(500);
    await screenshot(page, '02-guest-form');

    await page.getByPlaceholder(/name/i).fill('TestPlayer');
    await screenshot(page, '03-guest-filled');

    await page.getByRole('button', { name: /start playing/i }).click();
    await page.waitForTimeout(1000);

    // 3. Home Screen
    console.log('3. Home Screen');
    await screenshot(page, '04-home-screen');

    // 4. Create Game Settings
    console.log('4. Create Game');
    await page.getByRole('button', { name: /start a game/i }).click();
    await page.waitForTimeout(500);
    await screenshot(page, '05-create-game');

    // Create the game
    await page.getByRole('button', { name: /create game/i }).click();
    await page.waitForTimeout(1500);

    // 5. Game Lobby
    console.log('5. Game Lobby');
    await screenshot(page, '06-lobby-empty');

    // Try to add AI
    const addAI = page.getByRole('button', { name: /add ai/i });
    if (await addAI.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addAI.click();
      await page.waitForTimeout(500);
      await screenshot(page, '07-add-ai-form');

      // Submit AI
      await page.getByRole('button', { name: /^add$/i }).click();
      await page.waitForTimeout(1000);
      await screenshot(page, '08-lobby-with-ai');
    }

    // Start game
    console.log('6. Starting Game');
    const startGame = page.getByRole('button', { name: /start game/i });
    if (await startGame.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startGame.click();
      await page.waitForTimeout(2000);
    }

    // 7. Gameplay
    console.log('7. Gameplay');
    await screenshot(page, '09-game-start');

    // Try to play a few turns
    for (let i = 0; i < 5; i++) {
      // Check for roll button
      const rollBtn = page.getByRole('button', { name: /roll/i });
      const canRoll = await rollBtn.isVisible().catch(() => false) &&
                      await rollBtn.isEnabled().catch(() => false);

      if (canRoll) {
        await rollBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, `10-turn-${i+1}-after-roll`);

        // Try to click scoring dice
        const dice = page.locator('.die:not([disabled])');
        const count = await dice.count();
        for (let j = 0; j < Math.min(count, 2); j++) {
          try {
            await dice.nth(j).click();
            await page.waitForTimeout(300);
          } catch (e) {}
        }
        await screenshot(page, `11-turn-${i+1}-dice-selected`);

        // Try to bank
        const bankBtn = page.getByRole('button', { name: /bank/i });
        if (await bankBtn.isVisible().catch(() => false)) {
          await bankBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, `12-turn-${i+1}-banked`);
        }
      } else {
        // AI turn - wait
        await page.waitForTimeout(3000);
        await screenshot(page, `13-ai-turn-${i+1}`);
      }
    }

    // 8. Help Panel
    console.log('8. Help Panel');
    const helpBtn = page.locator('button[aria-label*="help" i], button[aria-label*="How to Play" i]');
    if (await helpBtn.first().isVisible().catch(() => false)) {
      await helpBtn.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, '14-help-panel');

      // Close it
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 9. Join Game Screen
    console.log('9. Join Game');
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /join game/i }).click();
    await page.waitForTimeout(500);
    await screenshot(page, '15-join-game');

    console.log('\n✅ Mobile audit complete!');
    console.log(`📁 Output: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('Error:', error.message);
    await screenshot(page, 'error-state');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
