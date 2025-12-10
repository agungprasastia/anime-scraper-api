import cron from "node-cron";
import { scrapeOngoing } from "./scraper/list.js";
import { scrapeDetail } from "./scraper/detail.js";

// Warm up 'ongoing' cache every 10 minutes
cron.schedule("*/10 * * * *", async () => {
    console.log("Cron: Warming up ongoing anime cache...");
    try {
        await scrapeOngoing();
    } catch (e) {
        console.error("Cron Error:", e);
    }
});

// Removed detail updater loop to avoid massive scraping.
// Details will be cached on demand via API.

// Initial warm setup
(async () => {
    console.log("Worker started. Running initial warm-up...");
    await scrapeOngoing();
})();
