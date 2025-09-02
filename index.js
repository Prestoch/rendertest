const express = require('express');
const { chromium } = require('playwright');
const app = express();

app.get('/render', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'missing url' });
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const html = await page.content();
    await browser.close();
    res.type('text/html').send(html);
  } catch (e) {
    if (browser) await browser.close();
    res.status(500).json({ error: e.message });
  }
});

// Optional JSON extractor for game-tournaments.com/dota2 match pages
app.get('/extract/gt', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'missing id' });
  const matchUrl = `https://game-tournaments.com/en/dota-2/matches/${id}`;
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newContext().then(c => c.newPage());
    await page.goto(matchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const data = await page.evaluate(() => {
      const pickBlocks = Array.from(document.querySelectorAll('div.heroes'));
      const getHeroes = blk =>
        Array.from(blk.querySelectorAll('div.card')).slice(0, 5).map(c => ({
          name: c.querySelector('.hero-title')?.textContent?.trim() || '',
          img: c.querySelector('img')?.getAttribute('src') || ''
        }));
      const t1 = pickBlocks[0] ? getHeroes(pickBlocks[0]) : [];
      const t2 = pickBlocks[1] ? getHeroes(pickBlocks[1]) : [];
      const up = document.querySelector('.team-name-up')?.textContent?.trim() || 'Radiant';
      const down = document.querySelector('.team-name-down')?.textContent?.trim() || 'Dire';
      const league = document.querySelector('a[itemprop=description][title]')?.getAttribute('title') ||
                     document.querySelector('title')?.textContent?.trim() || '';
      return { league, team1Name: up, team2Name: down, team1: t1, team2: t2 };
    });
    await browser.close();
    res.json(data);
  } catch (e) {
    if (browser) await browser.close();
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000);