import intelliSpotService from '../services/intelliSpotService.js';

export async function getSmartRecommendations(req, res) {
  try {
    const { lat, lng, userId, calendarAccessToken } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const numericLat = Number(lat); const numericLng = Number(lng);
    if (Number.isNaN(numericLat) || Number.isNaN(numericLng)) return res.status(400).json({ error: 'lat/lng must be numbers' });
    let token = calendarAccessToken;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    const data = await intelliSpotService.generateSmartRecommendations({ lat: numericLat, lng: numericLng, userId, calendarAccessToken: token });
    res.json(data);
  } catch (e) {
    console.error('IntelliSpot controller error:', e.message);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
}

export default { getSmartRecommendations };
