import { Router } from 'express';
import { searchPlacesController, handleGetPlaceDetails, handleGetPlacePhotos } from '../controllers/placesController.js';

const router = Router();

router.get('/search', searchPlacesController); 
router.get('/:id', handleGetPlaceDetails); 
router.get('/:id/photos', handleGetPlacePhotos); 

export default router;
