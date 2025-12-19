import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../utils/browser.ts";
import type { AnimeGridItem } from "../interfaces.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapePopular(): Promise<AnimeGridItem[]> {
    try {
        await sleep(Math.floor(Math.random() * 2000) + 1000);

        const url = "https://v1.samehadaku.how/";
        const html = await fetchWithBrowser(url, ".topten-animesu");
        const $ = cheerio.load(html);

        const items: AnimeGridItem[] = [];

        $(".topten-animesu li").each((i, el) => {
            // Title cleanup: "8.73 TOP1 One Piece" -> "One Piece"
            // The structure seems to have score and rank as text nodes or nested elements
            // Based on inspection: <a class="series">...TITLE...</a>
            // Actually inspection showed: "8.73 TOP1 One Piece" in text
            // Let's try to extract cleanly.

            const rawTitle = $(el).find(".entry-title, h3, h4, a").first().text().trim();
            // Regex to remove "8.73 TOP1 " prefix
            // It seems to be: [SCORE] [TOPn] [Title]
            const titleMatch = rawTitle.match(/(?:\d+\.?\d*)\s+TOP\d+\s+(.+)/i);
            const title = titleMatch ? titleMatch[1].trim() : rawTitle;

            const link = $(el).find("a").first().attr("href");
            const imgEl = $(el).find("img");
            const poster = imgEl.attr("src") || imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("data-original");

            if (!title || !link) return;

            const slug = link.replace("https://v1.samehadaku.how/anime/", "").replace(/\/$/, "");

            items.push({
                title,
                slug,
                poster,
                score: rawTitle.split(" ")[0], // extracting score roughly
                current_episode: "Unknown", // Not available in top list
                release_day: "Unknown",    // Not available in top list
                link
            });
        });

        return items;

    } catch (err) {
        console.error("Scrape popular error:", err);
        return [];
    }
}
