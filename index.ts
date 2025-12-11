import { Elysia } from "elysia";
import dotenv from "dotenv";
import { router } from "./src/api.ts";
import "./src/worker.ts";

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = new Elysia()
    .use(router)
    .listen(PORT);

console.log(`API running on port ${app.server?.port}`);
