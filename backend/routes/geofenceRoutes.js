import { Router } from 'express';
import { create, batch, list, get, update, remove, registerDevice, updateDevice, listDevices, events, setGeofence } from '../controllers/geofenceController.js';

const router = Router();

router.post('/', create);
router.post('/set', setGeofence);
router.post('/batch', batch);
router.get('/', list);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

router.post('/devices', registerDevice);
router.get('/devices', listDevices);
router.patch('/devices/:id', updateDevice);

router.get('/events', events);

export default router;
