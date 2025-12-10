import cron from "node-cron";
import { scrapeOngoing } from "./scraper/list.js";

cron.schedule("*/10 * * * *", async () => {
    console.log("Cron: Warming up ongoing anime cache...");
    try {
        await scrapeOngoing();
    } catch (e) {
        console.error("Cron Error:", e);
    }
});

(async () => {
    console.log("Worker started. Running initial warm-up...");
    await scrapeOngoing();
})();
