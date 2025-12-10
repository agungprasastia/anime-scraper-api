import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../utils/browser.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapeSearch(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://v1.samehadaku.how/?s=${encodedQuery}`;

    try {
        await sleep(Math.floor(Math.random() * 2000) + 1000);

        const html = await fetchWithBrowser(url, "main#main .animpost");
        const $ = cheerio.load(html);

        const items = [];

        $("main#main .animpost").each((i, el) => {
            const title = $(el).find(".animposx a .data .title h2").text().trim();
            const link = $(el).find(".animposx a").attr("href");
            const poster = $(el).find(".animposx .content-thumb img").attr("src");
            const score = $(el).find(".animposx .content-thumb .score").text().trim();
            const type = $(el).find(".animposx .data .type").text().trim();

            if (title && link) {
                const slug = link.replace("https://v1.samehadaku.how/anime/", "").replace(/\/$/, "");

                items.push({
                    title,
                    slug,
                    poster,
                    score,
                    status: type,
                    link
                });
            }
        });

        return items;

    } catch (err) {
        console.error(`Search scrape error (${query}):`, err.message);
        return [];
    }
}
