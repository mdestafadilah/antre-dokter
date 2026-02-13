import { Hono } from 'hono';
import {
  getAvailableSlots,
  bookQueue,
  getMyQueues,
  getCurrentQueue,
  cancelQueue,
  callNextQueue,
  completeQueue,
  updateQueueStatus,
  getQueuesByDate,
  bookQueueForPatient,
  getReportsByDateRange
} from '../controllers/queueController.js';
import { validateQueueBooking } from '../middleware/validation.js';
import { authenticate, authorize } from '../middleware/auth.js';

const queueRoutes = new Hono();

// Public routes
queueRoutes.get('/available-slots', getAvailableSlots);
queueRoutes.get('/current', getCurrentQueue);

// Patient routes
queueRoutes.get('/my-queues', authenticate, getMyQueues);
queueRoutes.post('/book', authenticate, authorize('patient'), validateQueueBooking, bookQueue);
queueRoutes.patch('/cancel/:queueId', authenticate, authorize('patient'), cancelQueue);

// Admin routes for queue management
queueRoutes.post('/call-next', authenticate, authorize('admin'), callNextQueue);
queueRoutes.patch('/complete/:queueId', authenticate, authorize('admin'), completeQueue);
queueRoutes.patch('/update-status/:queueId', authenticate, authorize('admin'), updateQueueStatus);
queueRoutes.get('/by-date', authenticate, authorize('admin'), getQueuesByDate);
queueRoutes.get('/reports', authenticate, authorize('admin'), getReportsByDateRange);
queueRoutes.post('/admin-book', authenticate, authorize('admin'), bookQueueForPatient);

export default queueRoutes;
