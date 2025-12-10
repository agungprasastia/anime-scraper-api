# Anime Scraper API

## API Reference

| Feature | Endpoint | Method | Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Ongoing Anime** | `/anime/ongoing` | `GET` | - | Returns a list of ongoing anime. |
| **Search Anime** | `/anime/search` | `GET` | `q` (required) | Search for anime by title. |
| **Get Schedule** | `/anime/schedule` | `GET` | - | Returns the weekly anime release schedule. |
| **Anime Details** | `/anime/:slug` | `GET` | `slug` (path) | Get full details for an anime. |
| **Episode Details** | `/anime/episode/:slug` | `GET` | `slug` (path) | Retrieve streaming links and download options. |
| **Get Server Stream** | `/anime/server` | `POST` | `slug`, `post`, `nume`, `type` (body) | Resolve specific server streaming URLs. |

## Tech Stack

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![ElysiaJS](https://img.shields.io/badge/elysiajs-23c45e?style=for-the-badge&logo=elysia&logoColor=white)

## Getting Started

### Prerequisites

- **Bun** (v1.0+ required)
- Puppeteer compatible environment

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/agungprasastia/anime-scraper-api.git
   cd anime-scraper
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory (optional, defaults provided in code):
   ```env
   PORT=3000
   ```

### Running the Server

Start the application:
```bash
bun start
```
The server will run on `http://localhost:3000` (or your specified PORT).

