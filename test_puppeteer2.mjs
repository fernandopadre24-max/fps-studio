import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:3000');
    
    await page.type('#loginEmail', 'admin@admin.com');
    await page.type('#loginPassword', 'admin');
    await page.click('#loginForm button');
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => openModal('servicoModal'));
    await new Promise(r => setTimeout(r, 500));
    
    await page.type('#servicoNome', 'Teste Puppeteer');
    await page.evaluate(() => salvarServico());
    await new Promise(r => setTimeout(r, 1000));
    
    const count = await page.evaluate(() => DB.servicos.length);
    console.log("QTD SERVICOS:", count);
    
    await browser.close();
})();
