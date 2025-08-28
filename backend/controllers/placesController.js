import { searchPlaces, getPlaceDetails, getPlacePhotos } from '../services/foursquareService.js';

export const handleSearchPlaces = async (req, res) => {
  try {
    const { lat, lng, query = 'coffee', limit = 10, radius = 1000 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }
    const numericLat = Number(lat);
    const numericLng = Number(lng);
    if (Number.isNaN(numericLat) || Number.isNaN(numericLng)) {
      return res.status(400).json({ error: 'lat and lng must be numbers' });
    }
    const data = await searchPlaces(numericLat, numericLng, query, Number(limit) || 10, Number(radius) || 1000);
    res.json(data);
  } catch (err) {
    console.error('Error searching places:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || 'Error searching places'
    });
  }
};

export const handleGetPlaceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id param required' });
    const data = await getPlaceDetails(id);
    res.json(data);
  } catch (err) {
    console.error('Error fetching place details:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || 'Error fetching place details'
    });
  }
};

export const handleGetPlacePhotos = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id param required' });
    const data = await getPlacePhotos(id);
    res.json(data);
  } catch (err) {
    console.error('Error fetching place photos:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || 'Error fetching place photos'
    });
  }
};

export const searchPlacesController = handleSearchPlaces;

export default {
  searchPlacesController: handleSearchPlaces,
  handleSearchPlaces,
  handleGetPlaceDetails,
  handleGetPlacePhotos
};
