import { sendFeedback } from '../services/placesService.js';

export async function submitFeedback(req, res) {
  try {
    const { userId, venueId, feedback } = req.body;
    const response = await sendFeedback(userId, venueId, feedback);
    res.status(201).json({ success: true, response });
  } catch (err) {
    console.error('Error submitting feedback:', err.message);
    res.status(err.status || 500).json({ error: 'Failed to submit feedback' });
  }
}

export async function submitDetailedFeedback(req, res) {
  try {
    const { userId, venueId, feedback, details } = req.body;
    const combined = { ...feedback, details };
    const response = await sendFeedback(userId, venueId, combined);
    res.status(201).json({ success: true, response });
  } catch (err) {
    console.error('Error submitting detailed feedback:', err.message);
    res.status(err.status || 500).json({ error: 'Failed to submit detailed feedback' });
  }
}
