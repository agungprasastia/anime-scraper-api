import express from "express";
import dotenv from "dotenv";
import { router } from "./src/api.js";
import "./src/worker.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port", PORT));
