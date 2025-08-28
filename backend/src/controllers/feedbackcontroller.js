import { saveFeedback } from "../services/feedback.js";


export async function giveDetailedFeedback(req, res) {
  try {
    const userId = req.user._id;
    const { venue, liked, rating, comment, skipped } = req.body;

    if (!venue) return res.status(400).json({ error: "Venue data required" });

    const feedback = await saveFeedback(userId, venue, { liked, rating, comment, skipped });

    res.json({ message: "Detailed feedback recorded", feedback });
  } catch (err) {
    console.error("Error saving detailed feedback:", err.message);
    res.status(500).json({ error: "Failed to save feedback" });
  }
}
