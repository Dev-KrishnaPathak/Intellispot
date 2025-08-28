export async function getUserLocation(req) {
  const { lat, lon } = req.body || {};
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null; 
  }
  return { lat, lon };
}

export default { getUserLocation };
