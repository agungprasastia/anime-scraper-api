import * as cheerio from "cheerio";
import { openBrowser, closeBrowser } from "../utils/browser.js";

export async function getServerStream(sourceUrl, post, nume, type) {
    try {
        console.log(`Getting server stream for Post:${post} Nume:${nume} Type:${type} from ${sourceUrl}`);
        const browser = await openBrowser();
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to the episode page to establish context (cookies, referrer, nonce)
        await page.goto(sourceUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Execute AJAX request in the page context
        // We use the site's own jQuery ($) to ensure headers/nonces are handled if they are attached globally
        const resultHtml = await page.evaluate(async (post, nume, type) => {
            return await new Promise((resolve, reject) => {
                jQuery.ajax({
                    url: '/wp-admin/admin-ajax.php',
                    type: 'POST',
                    data: {
                        action: 'player_ajax',
                        post: post,
                        nume: nume,
                        type: type
                    },
                    success: function (data) {
                        resolve(data);
                    },
                    error: function (err) {
                        reject(err.statusText);
                    }
                });
            });
        }, post, nume, type);

        await page.close();

        // Parse result (usually returns HTML with iframe)
        const $ = cheerio.load(resultHtml);
        const iframeSrc = $("iframe").attr("src");

        console.log(`Found server stream: ${iframeSrc}`);
        return iframeSrc;

    } catch (err) {
        console.error(`Server scrape error:`, err);
        return null;
    }
}
