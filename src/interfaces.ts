export interface AnimeDetail {
    title: string;
    slug: string;
    poster: string | undefined;
    synopsis: string;
    status: string;
    rating: string;
    genres: { name: string; slug: string }[];
    episode_lists: { episode: string; slug: string; date: string }[];
}

export interface StreamServer {
    name: string;
    postData: string | undefined;
    nume: string | undefined;
    type: string | undefined;
}

export interface DownloadLink {
    resolution: string;
    urls: { provider: string; url: string | undefined }[];
}

export interface EpisodeDetail {
    title: string;
    episode: string;
    releaseDate: string;
    defaultStream: string | undefined;
    stream_servers: StreamServer[];
    download_urls: Record<string, DownloadLink[]>;
}

export interface AnimeGridItem {
    title: string;
    slug: string;
    poster: string | undefined;
    current_episode?: string;
    newest_release_date?: string;
    release_day?: string;
    link: string | undefined;
    score?: string;
    status?: string;
}

export interface ScheduleAnime {
    title: string;
    slug: string;
    poster: string;
    score: string;
    genres: string[];
    release_time: string;
    link: string;
}

export interface ScheduleDay {
    day: string;
    anime: ScheduleAnime[];
}
