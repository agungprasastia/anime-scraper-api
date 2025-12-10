import { fetchWithBrowser } from "../utils/browser.js";
import * as cheerio from "cheerio";

const DAYS = {
    monday: "Senin",
    tuesday: "Selasa",
    wednesday: "Rabu",
    thursday: "Kamis",
    friday: "Jumat",
    saturday: "Sabtu",
    sunday: "Minggu"
};

const cleanJson = (text) => {
    // Sometimes puppeteer returns HTML wrapping the JSON
    // Expected format: <html><head></head><body><pre>{...}</pre></body></html>
    // Or just the body content
    try {
        const $ = cheerio.load(text);
        const pre = $("pre").text();
        if (pre) return JSON.parse(pre);

        // If no pre, try parsing the body text
        const body = $("body").text();
        if (body) return JSON.parse(body);

        return JSON.parse(text);
    } catch (e) {
        console.warn("Failed to parse JSON from page content, trying raw text cleanup");
        // Fallback: try to find start and end of JSON
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
            return JSON.parse(text.substring(start, end + 1));
        }
        return [];
    }
};

export async function scrapeSchedule() {
    console.log("Scraping schedule...");
    const schedule = [];

    for (const [dayKey, dayName] of Object.entries(DAYS)) {
        try {
            console.log(`Fetching schedule for ${dayName} (${dayKey})...`);
            // Using the internal API found in the site source
            const url = `https://v1.samehadaku.how/wp-json/custom/v1/all-schedule?perpage=20&day=${dayKey}&type=schtml`;

            // We use fetchWithBrowser because simple fetch/axios gets 403 denied
            const html = await fetchWithBrowser(url);

            const data = cleanJson(html);

            if (Array.isArray(data)) {
                const animeList = data.map(item => ({
                    title: item.title,
                    slug: item.url.split("/anime/")[1]?.replace(/\/$/, "") || "",
                    poster: item.featured_img_src,
                    score: item.east_score,
                    genres: item.genre,
                    release_time: item.east_time,
                    link: item.url
                }));

                schedule.push({
                    day: dayName,
                    anime: animeList
                });
            }
        } catch (err) {
            console.error(`Error scraping schedule for ${dayName}:`, err);
        }
    }

    return schedule;
}
