const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('error', err => console.log('ERROR:', err.toString()));

  await page.goto('http://localhost:8000/index.html');
  await page.click('#start-camera');
  
  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
})();
