import { Hono } from 'hono';
import {
  getPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../controllers/notificationController.ts';
import { authenticate, authorize } from '../middleware/auth.ts';

const notificationRoutes = new Hono();

// Patient notification routes
notificationRoutes.get('/', authenticate, authorize('patient'), getPatientNotifications);
notificationRoutes.patch('/:notificationId/read', authenticate, authorize('patient'), markNotificationAsRead);
notificationRoutes.patch('/mark-all-read', authenticate, authorize('patient'), markAllNotificationsAsRead);

export default notificationRoutes;
