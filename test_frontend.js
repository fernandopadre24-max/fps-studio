const puppeteer = require('/app/applet/node_modules/puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto('http://localhost:3000');
    
    // Login as admin
    await page.type('#loginEmail', 'admin@fps.com');
    await page.type('#loginSenha', '123456');
    await page.click('button[onclick="login()"]');
    
    await page.waitForTimeout(1000);
    
    // Switch to servicos page
    await page.evaluate(() => {
        document.querySelector('a[data-page="adminServicos"]').click();
    });
    await page.waitForTimeout(500);
    
    // Open modal
    await page.evaluate(() => {
        openModal('servicoModal');
    });
    
    // Fill form
    await page.type('#servicoNome', 'Test Puppeteer');
    await page.type('#servicoPreco', '50,00');
    
    // Click save
    await page.evaluate(() => {
        salvarServico();
    });
    
    await page.waitForTimeout(1000);
    await browser.close();
})();
