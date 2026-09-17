import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('http://localhost:3000');
    
    await page.type('#loginUsername', 'admin');
    await page.type('#loginPassword', 'admin123');
    await page.click('button[onclick="login()"]');
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => openModal('servicoModal'));
    await new Promise(r => setTimeout(r, 500));
    
    await page.type('#servicoNome', 'Teste Puppeteer');
    await page.evaluate(() => salvarServico());
    await new Promise(r => setTimeout(r, 1000));
    
    await browser.close();
})();
