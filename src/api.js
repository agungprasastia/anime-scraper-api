import express from "express";
import NodeCache from "node-cache";
import { scrapeOngoing } from "./scraper/list.js";
import { scrapeDetail } from "./scraper/detail.js";
import { scrapeSearch } from "./scraper/search.js";
import { scrapeEpisode } from "./scraper/episode.js";
import { getServerStream } from "./scraper/server.js";
import { scrapeSchedule } from "./scraper/schedule.js";

export const router = express.Router();

// Cache TTL: 15 minutes (900 seconds)
const cache = new NodeCache({ stdTTL: 900 });

// Ensure we don't trigger multiple scrapes for the same resource simultaneously
const activeRequests = new Map();

// Helper to handle simple caching logic with promise coalescing
const getOrFetch = async (key, fetchFn) => {
    // Return cached data if available
    const cachedData = cache.get(key);
    if (cachedData) return cachedData;

    // Return active promise if already fetching
    if (activeRequests.has(key)) return activeRequests.get(key);

    const promise = (async () => {
        try {
            const data = await fetchFn();
            if (data) cache.set(key, data);
            return data;
        } finally {
            activeRequests.delete(key);
        }
    })();

    activeRequests.set(key, promise);
    return promise;
};

router.get("/anime/ongoing", async (req, res) => {
    try {
        const ongoingData = await getOrFetch("ongoing_anime", scrapeOngoing);

        // Try to fetch schedule data (cached) to get better posters
        try {
            console.log("Starting poster enhancement...");
            const scheduleData = await getOrFetch("anime_schedule", scrapeSchedule);

            if (scheduleData) {
                // console.log(`Poster Enhancement: Got ${scheduleData.length} days of schedule.`);
            } else {
                // console.log("Poster Enhancement: Schedule data is null/undefined");
            }

            const posterMap = new Map();

            // Build a map of slug -> poster from schedule
            if (Array.isArray(scheduleData)) {
                scheduleData.forEach(day => {
                    if (day.anime && Array.isArray(day.anime)) {
                        day.anime.forEach(anime => {
                            if (anime.slug && anime.poster) {
                                posterMap.set(anime.slug, anime.poster);
                            }
                        });
                    }
                });

                // console.log(`Poster Enhancement: Built map with ${posterMap.size} posters.`);

                // Update ongoing data with better posters and release info
                let mergedCount = 0;
                if (Array.isArray(ongoingData)) {
                    ongoingData.forEach(anime => {
                        if (posterMap.has(anime.slug)) {
                            // console.log(`Replacing poster for ${anime.slug}`);
                            anime.poster = posterMap.get(anime.slug);
                            mergedCount++;
                        }

                        // Also try to find day info from schedule
                        const scheduleItem = scheduleData.flatMap(d => d.anime.map(a => ({ ...a, day: d.day }))).find(a => a.slug === anime.slug);
                        if (scheduleItem) {
                            anime.release_day = scheduleItem.day;
                        }
                    });
                    // console.log(`Poster Enhancement: Successfully merged ${mergedCount}/${ongoingData.length} items.`);
                }
            }
        } catch (e) {
            console.warn("Failed to enhance posters with schedule data:", e);
            // Non-critical, continue with original data
        }

        res.json({
            status: "success",
            data: {
                ongoingAnimeData: ongoingData || [],
                paginationData: {
                    current_page: 1,
                    has_next_page: false,
                    has_previous_page: false,
                    last_visible_page: 1,
                    next_page: null,
                    previous_page: null
                }
            }
        });
    } catch (err) {
        console.error("API Ongoing Error:", err);
        res.status(500).json({ error: "Failed to fetch ongoing anime" });
    }
});

// Search
router.get("/anime/search", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Query 'q' is required" });

    try {
        const data = await getOrFetch(`search_${query}`, () => scrapeSearch(query));
        res.json(data || []);
    } catch (err) {
        console.error(`API Search Error (${query}):`, err);
        res.status(500).json({ error: "Failed to search anime" });
    }
});

// Schedule
router.get("/anime/schedule", async (req, res) => {
    try {
        // Cache for 1 hour (3600 seconds) since schedule doesn't change often
        const data = await getOrFetch("anime_schedule", scrapeSchedule);
        res.json(data || []);
    } catch (err) {
        console.error("API Schedule Error:", err);
        res.status(500).json({ error: "Failed to fetch schedule" });
    }
});

// Detail
router.get("/anime/:slug", async (req, res) => {
    const slug = req.params.slug;
    try {
        const data = await getOrFetch(`detail_${slug}`, () => scrapeDetail(slug));
        if (!data) return res.status(404).json({ error: "Not found" });
        res.json(data);
    } catch (err) {
        console.error(`API Detail Error (${slug}):`, err);
        res.status(500).json({ error: "Failed to fetch anime detail" });
    }
});

// Episodes (Included in detail now, but kept for compatibility if needed)
router.get("/anime/:slug/episodes", async (req, res) => {
    const slug = req.params.slug;
    try {
        const data = await getOrFetch(`detail_${slug}`, () => scrapeDetail(slug));
        if (!data) return res.status(404).json({ error: "Not found" });
        res.json(data.episodes || []);
    } catch (err) {
        console.error(`API Episodes Error (${slug}):`, err);
        res.status(500).json({ error: "Failed to fetch episodes" });
    }
});

// Episode Detail (Streaming & Downloads)
router.get("/anime/episode/:slug", async (req, res) => {
    const slug = req.params.slug;
    try {
        const data = await getOrFetch(`episode_${slug}`, async () => {
            // console.log(`API: Fetching episode ${slug}...`);
            const result = await scrapeEpisode(slug);
            // console.log(`API: Scrape result for ${slug}:`, JSON.stringify(result, null, 2));
            return result;
        });

        if (!data) return res.status(404).json({ error: "Episode not found" });
        res.json(data);
    } catch (err) {
        console.error(`API Episode Error (${slug}):`, err);
        res.status(500).json({ error: "Failed to fetch episode" });
    }
});

// Server Stream (AJAX)
router.post("/anime/server", async (req, res) => {
    const { slug, post, nume, type } = req.body;
    if (!slug || !post || !nume || !type) {
        return res.status(400).json({ error: "Missing parameters" });
    }

    try {
        const url = `https://v1.samehadaku.how/${slug}/`;
        const streamUrl = await getServerStream(url, post, nume, type);

        if (!streamUrl) return res.status(404).json({ error: "Stream not found" });
        res.json({ streamUrl });
    } catch (err) {
        console.error(`API Server Error:`, err);
        res.status(500).json({ error: "Failed to fetch server stream" });
    }
});
