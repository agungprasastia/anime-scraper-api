import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../utils/browser.ts";
import type { AnimeGridItem } from "../interfaces.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapeOngoing(page: number = 1): Promise<AnimeGridItem[]> {
    try {
        await sleep(Math.floor(Math.random() * 2000) + 1000);

        const url = page === 1 ? "https://v1.samehadaku.how/" : `https://v1.samehadaku.how/page/${page}/`;
        const html = await fetchWithBrowser(url, ".post-show ul li");
        const $ = cheerio.load(html);

        const items: AnimeGridItem[] = [];

        $(".post-show ul li").each((i, el) => {
            const title = $(el).find(".entry-title a").attr("title")?.trim() || "";
            const link = $(el).find(".entry-title a").attr("href");
            const poster = $(el).find(".thumb img").attr("src");

            const episodeNum = $(el).find("span:contains('Episode') author").text().trim();
            const episode = episodeNum ? `Episode ${episodeNum}` : "Unknown Episode";

            if (!title || !link) return;

            const slug = link.replace("https://v1.samehadaku.how/anime/", "").replace(/\/$/, "");

            let releaseDate = $(el).find("span:contains('Released on')").text().replace("Released on:", "").trim();
            if (!releaseDate) {
                releaseDate = $(el).find(".dtla span").first().text().trim();
            }

            items.push({
                title,
                slug,
                poster,
                current_episode: episode,
                newest_release_date: releaseDate,
                release_day: "Unknown",
                link
            });
        });

        return items;

    } catch (err) {
        console.error("Scrape ongoing error:", err);
        return [];
    }
}
