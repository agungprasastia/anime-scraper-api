import { Elysia, t, type Context } from "elysia";
import NodeCache from "node-cache";
import { scrapeOngoing } from "./scraper/list.ts";
import { scrapeDetail } from "./scraper/detail.ts";
import { scrapeSearch } from "./scraper/search.ts";
import { scrapeEpisode } from "./scraper/episode.ts";
import { getServerStream } from "./scraper/server.ts";
import { scrapeSchedule } from "./scraper/schedule.ts";
import { scrapePopular } from "./scraper/popular.ts";
import type { AnimeDetail, AnimeGridItem, ScheduleAnime, ScheduleDay } from "./interfaces.ts";

const cache = new NodeCache({ stdTTL: 900 });

const activeRequests = new Map<string, Promise<any>>();

const getOrFetch = async <T>(key: string, fetchFn: () => Promise<T>): Promise<T | undefined> => {
    const cachedData = cache.get<T>(key);
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
            const page = parseInt(query.page ?? "1") || 1;
            const ongoingData = await getOrFetch<AnimeGridItem[]>(`ongoing_anime_${page}`, () => scrapeOngoing(page));

            try {
                const scheduleData = await getOrFetch<ScheduleDay[]>("anime_schedule", scrapeSchedule);

                const posterMap = new Map<string, string>();

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
                                const poster = posterMap.get(anime.slug);
                                if (poster) anime.poster = poster;
                            }

                            const scheduleItem = scheduleData.flatMap(d => d.anime.map(a => ({ ...a, day: d.day }))).find(a => a.slug === anime.slug);
                            if (scheduleItem) {
                                anime.release_day = (scheduleItem as any).day;
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
                        current_page: page,
                        has_next_page: true,
                        has_previous_page: page > 1,
                        last_visible_page: page + 1,
                        next_page: page + 1,
                        previous_page: page > 1 ? (page - 1) : null
                    }
                }
            };
        } catch (err) {
            console.error("API Ongoing Error:", err);
            set.status = 500;
            return { error: "Failed to fetch ongoing anime" };
        }
    }, {
        query: t.Object({
            page: t.Optional(t.String())
        })
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
    }, {
        query: t.Object({
            q: t.String()
        })
    })

    .get("/anime/schedule", async ({ set }) => {
        try {
            const data = await getOrFetch<ScheduleDay[]>("anime_schedule", scrapeSchedule);
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
    }, {
        params: t.Object({
            slug: t.String()
        })
    })

    .get("/anime/:slug/episodes", async ({ params: { slug }, set }) => {
        try {
            const data = await getOrFetch(`detail_${slug}`, () => scrapeDetail(slug));
            if (!data) {
                set.status = 404;
                return { error: "Not found" };
            }
            return data.episode_lists || [];
        } catch (err) {
            console.error(`API Episodes Error (${slug}):`, err);
            set.status = 500;
            return { error: "Failed to fetch episodes" };
        }
    }, {
        params: t.Object({
            slug: t.String()
        })
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
    }, {
        params: t.Object({
            slug: t.String()
        })
    })

    .get("/anime/popular", async ({ set }) => {
        try {
            const data = await getOrFetch("popular_anime", scrapePopular);
            return data || [];
        } catch (err) {
            console.error("API Popular Error:", err);
            set.status = 500;
            return { error: "Failed to fetch popular anime" };
        }
    })

    .post("/anime/server", async ({ body, set }) => {
        const { slug, post, nume, type } = body;

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
    }, {
        body: t.Object({
            slug: t.String(),
            post: t.String(),
            nume: t.String(),
            type: t.String()
        })
    });
