import puppeteer, { type Browser } from 'puppeteer';

let browser: Browser | null = null;

export const openBrowser = async (): Promise<Browser> => {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions',
                '--disable-gpu'
            ]
        });
    }
    return browser;
};

export const closeBrowser = async (): Promise<void> => {
    if (browser) {
        await browser.close();
        browser = null;
    }
};

export const fetchWithBrowser = async (url: string, waitSelector: string = 'body'): Promise<string> => {
    const browserInstance = await openBrowser();
    const page = await browserInstance.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        if (waitSelector) {
            try {
                await page.waitForSelector(waitSelector, { timeout: 30000 });
            } catch (e) {
                console.warn(`Timeout waiting for selector ${waitSelector} on ${url}, proceeding with available content.`);
            }
        }

        const content = await page.content();
        return content;
    } catch (error) {
        console.error(`Error fetching ${url} with browser:`, error);
        throw error;
    } finally {
        await page.close();
    }
};
