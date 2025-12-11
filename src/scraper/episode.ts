import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../utils/browser.ts";
import type { EpisodeDetail, StreamServer, DownloadLink } from "../interfaces.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapeEpisode(slug: string): Promise<EpisodeDetail | null> {
    const url = `https://v1.samehadaku.how/${slug}/`;

    try {
        console.log(`Scraping episode: ${slug}`);
        await sleep(Math.floor(Math.random() * 2000) + 1000);

        const html = await fetchWithBrowser(url, "#player_embed iframe");
        const $ = cheerio.load(html);

        const title = $("h1.entry-title").text().trim();
        const releaseDate = $("time.entry-date").text().trim();

        if (!title) {
            console.warn(`WARNING: Title not found for ${slug}`);
            console.warn("Page Title:", $("title").text());
            console.warn("HTML Length:", html.length);
        }

        const defaultStream = $("#player_embed iframe").attr("src")
            || $(".pframe iframe").attr("src")
            || $("#pembed iframe").attr("src");

        console.log("Default stream found:", defaultStream);

        const serverList: StreamServer[] = [];
        const serverElements = $(".east_player_option");

        serverElements.each((i, el) => {
            const name = $(el).find("span").text().trim();
            const postData = $(el).attr("data-post");
            const nume = $(el).attr("data-nume");
            const type = $(el).attr("data-type");

            if (name) {
                serverList.push({ name, postData, nume, type });
            }
        });

        const downloadLinks: { format: string; links: DownloadLink[] }[] = [];
        const downloadElements = $(".download-eps");

        downloadElements.each((i, el) => {
            const format = $(el).find("p").text().trim();
            const links: DownloadLink[] = [];

            $(el).find("ul li").each((j, li) => {
                const resolution = $(li).find("strong").text().trim();
                const urls: { provider: string; url: string | undefined }[] = [];

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

        const download_urls: Record<string, DownloadLink[]> = {};
        downloadLinks.forEach(item => {
            download_urls[item.format] = item.links;
        });

        const result: EpisodeDetail = {
            title,
            episode: title,
            releaseDate,
            defaultStream,
            stream_servers: serverList,
            download_urls
        };

        return result;

    } catch (err: any) {
        console.error(`Episode scrape error (${slug}):`, err.message);
        return null;
    }
}
