import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../utils/browser.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapeEpisode(slug) {
    const url = `https://v1.samehadaku.how/${slug}/`;

    try {
        console.log(`Scraping episode: ${slug}`);
        // Anti-bot: Random delay
        await sleep(Math.floor(Math.random() * 2000) + 1000);

        // Fetch body to ensure we get the content
        // Wait specifically for the player iframe to ensure it's loaded
        const html = await fetchWithBrowser(url, "#player_embed iframe");
        const $ = cheerio.load(html);

        const title = $("h1.entry-title").text().trim();
        const releaseDate = $("time.entry-date").text().trim(); // Sometimes useful if available

        if (!title) {
            console.warn(`WARNING: Title not found for ${slug}`);
            console.warn("Page Title:", $("title").text());
            console.warn("HTML Length:", html.length);
            // Optionally save debug html here if needed
        }

        // 1. Get Default Stream
        const defaultStream = $("#player_embed iframe").attr("src")
            || $(".pframe iframe").attr("src")
            || $("#pembed iframe").attr("src");

        console.log("Default stream found:", defaultStream);

        // 2. Get Server List
        // 2. Get Server List
        const serverList = [];
        const serverElements = $(".east_player_option");
        // console.log(`Debug: Found ${serverElements.length} server elements`);

        serverElements.each((i, el) => {
            const name = $(el).find("span").text().trim();
            const postData = $(el).attr("data-post");
            const nume = $(el).attr("data-nume");
            const type = $(el).attr("data-type");

            if (name) {
                serverList.push({ name, postData, nume, type });
            }
        });

        // 3. Get Download Links
        const downloadLinks = [];
        const downloadElements = $(".download-eps");
        // console.log(`Debug: Found ${downloadElements.length} download sections`);

        downloadElements.each((i, el) => {
            const format = $(el).find("p").text().trim(); // e.g., "MKV", "MP4"
            const links = [];

            $(el).find("ul li").each((j, li) => {
                const resolution = $(li).find("strong").text().trim();
                const urls = [];

                $(li).find("span a").each((k, a) => {
                    urls.push({
                        provider: $(a).text().trim(),
                        url: $(a).attr("href")
                    });
                });

                links.push({ resolution, urls });
            });

            downloadLinks.push({ format, links });
        });

        // Transform downloads to object for Frontend
        const download_urls = {};
        downloadLinks.forEach(item => {
            download_urls[item.format] = item.links;
        });

        const result = {
            title,
            episode: title,
            releaseDate,
            defaultStream,
            stream_servers: serverList, // Renamed from serverList
            download_urls // Renamed and transformed from downloadLinks
        };

        return result;

    } catch (err) {
        console.error(`Episode scrape error (${slug}):`, err.message);
        return null;
    }
}
