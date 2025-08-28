import express from 'express';
import { handleSearchPlaces, handleGetPlaceDetails, handleGetPlacePhotos } from '../controllers/placeController.js';

const router = express.Router();

router.get('/search', handleSearchPlaces); 
router.get('/:id', handleGetPlaceDetails); 
router.get('/:id/photos', handleGetPlacePhotos); 

export default router;
