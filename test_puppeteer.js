const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://localhost:3000');
    
    // login
    await page.type('#loginUsername', 'admin');
    await page.type('#loginPassword', 'admin123');
    await page.click('button[onclick="login()"]');
    await page.waitForTimeout(500);
    
    // open servico modal
    await page.evaluate(() => openModal('servicoModal'));
    await page.waitForTimeout(500);
    
    // fill servico
    await page.type('#servicoNome', 'Teste de Servico');
    await page.type('#servicoDescricao', 'Descricao do servico');
    await page.type('#servicoPreco', '15000');
    
    // click save
    await page.evaluate(() => salvarServico());
    await page.waitForTimeout(500);
    
    await browser.close();
})();
