import { Elysia } from "elysia";
import NodeCache from "node-cache";
import { scrapeOngoing } from "./scraper/list.js";
import { scrapeDetail } from "./scraper/detail.js";
import { scrapeSearch } from "./scraper/search.js";
import { scrapeEpisode } from "./scraper/episode.js";
import { getServerStream } from "./scraper/server.js";
import { scrapeSchedule } from "./scraper/schedule.js";

const cache = new NodeCache({ stdTTL: 900 });

const activeRequests = new Map();

const getOrFetch = async (key, fetchFn) => {
    const cachedData = cache.get(key);
    if (cachedData) return cachedData;

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

export const router = new Elysia()
    .onError(({ code, error, set }) => {
        if (code === 'NOT_FOUND') {
            set.status = 404;
            return { error: 'Not Found' };
        }
        console.error('Elysia Error:', error);
        set.status = 500;
        return { error: 'Internal Server Error' };
    })

    .get("/anime/ongoing", async ({ query, set }) => {
        try {
            const page = parseInt(query.page) || 1;
            const ongoingData = await getOrFetch(`ongoing_anime_${page}`, () => scrapeOngoing(page));

            try {
                const scheduleData = await getOrFetch("anime_schedule", scrapeSchedule);

                const posterMap = new Map();

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

                    if (Array.isArray(ongoingData)) {
                        ongoingData.forEach(anime => {
                            if (posterMap.has(anime.slug)) {
                                anime.poster = posterMap.get(anime.slug);
                            }

                            const scheduleItem = scheduleData.flatMap(d => d.anime.map(a => ({ ...a, day: d.day }))).find(a => a.slug === anime.slug);
                            if (scheduleItem) {
                                anime.release_day = scheduleItem.day;
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to enhance posters with schedule data:", e);
            }

            return {
                status: "success",
                data: {
                    ongoingAnimeData: ongoingData || [],
                    paginationData: {
                        current_page: parseInt(query.page) || 1,
                        has_next_page: true,
                        has_previous_page: (parseInt(query.page) || 1) > 1,
                        last_visible_page: (parseInt(query.page) || 1) + 1,
                        next_page: (parseInt(query.page) || 1) + 1,
                        previous_page: (parseInt(query.page) || 1) > 1 ? (query.page - 1) : null
                    }
                }
            };
        } catch (err) {
            console.error("API Ongoing Error:", err);
            set.status = 500;
            return { error: "Failed to fetch ongoing anime" };
        }
    })

    .get("/anime/search", async ({ query, set }) => {
        const q = query.q;
        if (!q) {
            set.status = 400;
            return { error: "Query 'q' is required" };
        }

        try {
            const data = await getOrFetch(`search_${q}`, () => scrapeSearch(q));
            return data || [];
        } catch (err) {
            console.error(`API Search Error (${q}):`, err);
            set.status = 500;
            return { error: "Failed to search anime" };
        }
    })

    .get("/anime/schedule", async ({ set }) => {
        try {
            const data = await getOrFetch("anime_schedule", scrapeSchedule);
            return data || [];
        } catch (err) {
            console.error("API Schedule Error:", err);
            set.status = 500;
            return { error: "Failed to fetch schedule" };
        }
    })

    .get("/anime/:slug", async ({ params: { slug }, set }) => {
        try {
            const data = await getOrFetch(`detail_${slug}`, () => scrapeDetail(slug));
            if (!data) {
                set.status = 404;
                return { error: "Not found" };
            }
            return data;
        } catch (err) {
            console.error(`API Detail Error (${slug}):`, err);
            set.status = 500;
            return { error: "Failed to fetch anime detail" };
        }
    })

    .get("/anime/:slug/episodes", async ({ params: { slug }, set }) => {
        try {
            const data = await getOrFetch(`detail_${slug}`, () => scrapeDetail(slug));
            if (!data) {
                set.status = 404;
                return { error: "Not found" };
            }
            return data.episodes || [];
        } catch (err) {
            console.error(`API Episodes Error (${slug}):`, err);
            set.status = 500;
            return { error: "Failed to fetch episodes" };
        }
    })

    .get("/anime/episode/:slug", async ({ params: { slug }, set }) => {
        try {
            const data = await getOrFetch(`episode_${slug}`, async () => {
                const result = await scrapeEpisode(slug);
                return result;
            });

            if (!data) {
                set.status = 404;
                return { error: "Episode not found" };
            }
            return data;
        } catch (err) {
            console.error(`API Episode Error (${slug}):`, err);
            set.status = 500;
            return { error: "Failed to fetch episode" };
        }
    })

    .post("/anime/server", async ({ body, set }) => {
        const { slug, post, nume, type } = body;
        if (!slug || !post || !nume || !type) {
            set.status = 400;
            return { error: "Missing parameters" };
        }

        try {
            const url = `https://v1.samehadaku.how/${slug}/`;
            const streamUrl = await getServerStream(url, post, nume, type);

            if (!streamUrl) {
                set.status = 404;
                return { error: "Stream not found" };
            }
            return { streamUrl };
        } catch (err) {
            console.error(`API Server Error:`, err);
            set.status = 500;
            return { error: "Failed to fetch server stream" };
        }
    });
