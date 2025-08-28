import express from "express";
import { giveFeedback, giveDetailedFeedback } from "../controllers/feedbackController.js";

const router = express.Router();

router.post("/", giveFeedback);

router.post("/detailed", giveDetailedFeedback);

export default router;
