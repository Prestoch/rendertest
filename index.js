const express = require('express');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(StealthPlugin());
const app = express();

function isCf(title, html) {
  return /Attention Required|Just a moment/i.test(title) ||
         /cf-browser-verification|cf-challenge|__cf_chl_captcha/i.test(html || '');
}

function ctxOptions() {
  return {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1366, height: 768 },
    javaScriptEnabled: true
  };
}

app.get('/render', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'missing url' });
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ],
      proxy: process.env.OUTBOUND_PROXY_URL
        ? {
            server: process.env.OUTBOUND_PROXY_URL,
            username: process.env.OUTBOUND_PROXY_USERNAME,
            password: process.env.OUTBOUND_PROXY_PASSWORD
          }
        : undefined
    });

    // Persist cookies (helps if CF issues clearance cookies)
    const context = await browser.newContext({ ...ctxOptions() });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    for (let i = 0; i < 5; i++) {
      const title = await page.title();
      const html = await page.content();
      if (!isCf(title, html)) break;
      await page.waitForTimeout(4000);
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    const html = await page.content();
    await browser.close();
    res.type('text/html').send(html);
  } catch (e) {
    if (browser) await browser.close();
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000);
