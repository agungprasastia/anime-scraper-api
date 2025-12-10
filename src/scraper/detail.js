import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../utils/browser.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapeDetail(slug) {
    const url = `https://v1.samehadaku.how/anime/${slug}/`;

    try {
        console.log(`Scraping detail: ${url}`);
        await sleep(Math.floor(Math.random() * 3000) + 1000);

        const html = await fetchWithBrowser(url, ".lstepsiode.listeps ul li");
        const $ = cheerio.load(html);

        // Robust Title Extraction
        let title = $(".infoanime h2.entry-title").text().replace("Nonton Anime", "").trim();
        if (!title) {
            title = $("h1.entry-title").text().replace("Nonton Anime", "").trim();
        }

        // Robust Synopsis Extraction
        let synopsis = $(".desc .entry-content").text().trim();
        if (!synopsis) {
            synopsis = $(".entry-content").first().text().trim();
        }

        // Robust Status Extraction
        let status = "Ongoing";
        const statusLabel = $(".infoanime span:contains('Status')");
        if (statusLabel.length > 0) {
            // 1. Try text inside the span
            let text = statusLabel.text().replace("Status", "").replace(":", "").trim();
            if (text) {
                status = text;
            } else {
                // 2. Try next sibling text node
                const nextNode = statusLabel[0].nextSibling;
                if (nextNode && nextNode.type === 'text') {
                    status = nextNode.data.replace(":", "").trim();
                } else if (statusLabel.next().length > 0) {
                    // 3. Try next element sibling
                    status = statusLabel.next().text().trim();
                }
            }
        }

        // Ensure status defaults if empty string came back from robust checks
        if (!status) status = "Ongoing";

        const poster = $(".thumb img").attr("src");
        // const title = $(".infoanime h2.entry-title").text().replace("Nonton Anime", "").trim(); // Replaced above

        // const status = $(".infoanime span:contains('Status')").text().replace("Status", "").replace(":", "").trim() || "Ongoing"; // Replaced above
        const rating = $(".rating-area").text().trim() || $(".score").text().trim() || "N/A";

        const genres = [];
        $(".genre-info a").each((i, el) => {
            genres.push({
                name: $(el).text().trim(),
                slug: $(el).attr("href").split("/genre/")[1]?.replace(/\/$/, "") || ""
            });
        });

        const episode_lists = [];

        $(".lstepsiode.listeps ul li").each((i, el) => {
            const epNum = $(el).find(".epsright .eps a").text().trim();
            const epLink = $(el).find(".epsright .eps a").attr("href");
            const epDate = $(el).find(".epsleft .date").text().trim();

            if (!epLink || !epNum) return;

            const slug = epLink.replace("https://v1.samehadaku.how/", "").replace(/\/$/, "");

            episode_lists.push({
                episode: epNum,
                slug,
                date: epDate || ""
            });
        });

        console.log(`Found ${episode_lists.length} episodes for ${slug}`);

        return {
            title,
            slug,
            poster,
            synopsis,
            status,
            rating,
            genres,
            episode_lists
        };

    } catch (err) {
        console.error(`Detail scrape error (${slug}):`, err.message);
        return null;
    }
}
