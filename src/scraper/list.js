import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../utils/browser.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapeOngoing() {
    try {
        // console.log("Scraping ongoing anime from Samehadaku...");
        // Anti-bot: Random short delay before starting
        await sleep(Math.floor(Math.random() * 2000) + 1000);

        const html = await fetchWithBrowser("https://v1.samehadaku.how/", ".post-show ul li");
        const $ = cheerio.load(html);

        const items = [];

        $(".post-show ul li").each((i, el) => {
            const title = $(el).find(".entry-title a").attr("title")?.trim();
            const link = $(el).find(".entry-title a").attr("href");
            const poster = $(el).find(".thumb img").attr("src");

            const episodeNum = $(el).find("span:contains('Episode') author").text().trim();
            const episode = episodeNum ? `Episode ${episodeNum}` : "Unknown Episode";

            if (!title || !link) return;

            const slug = link.replace("https://v1.samehadaku.how/anime/", "").replace(/\/$/, "");

            // Extract release info
            // "Released on: 4 hours ago" or similar
            let releaseDate = $(el).find("span:contains('Released on')").text().replace("Released on:", "").trim();
            if (!releaseDate) {
                // Fallback to finding any span with "ago" or similar if structure changes
                releaseDate = $(el).find(".dtla span").first().text().trim();
            }

            items.push({
                title,
                slug,
                poster,
                current_episode: episode,
                newest_release_date: releaseDate,
                release_day: "Unknown", // Will be enriched by schedule merging
                link
            });
        });

        // console.log(`Found ${items.length} ongoing anime.`);
        return items;

    } catch (err) {
        console.error("Scrape ongoing error:", err);
        return [];
    }
}
