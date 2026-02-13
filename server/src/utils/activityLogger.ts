import { ActivityLog } from '../models/index.js';

interface LogActivityParams {
  type: 'queue_created' | 'queue_called' | 'queue_completed' | 'queue_cancelled' | 'queue_no_show' | 'user_registered' | 'user_login' | 'settings_updated';
  title: string;
  description: string;
  userId?: string;
  queueId?: string;
  metadata?: any;
}

export const logActivity = async ({
  type,
  title,
  description,
  userId,
  queueId,
  metadata
}: LogActivityParams) => {
  try {
    await ActivityLog.create({
      type,
      title,
      description,
      userId,
      queueId,
      metadata
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error to prevent breaking the main flow
  }
};

export const getActivityIcon = (type: string) => {
  const icons: Record<string, string> = {
    queue_created: '➕',
    queue_called: '📢',
    queue_completed: '✅', 
    queue_cancelled: '❌',
    queue_no_show: '👻',
    user_registered: '👤',
    user_login: '🔑',
    settings_updated: '⚙️'
  };
  return icons[type] || '📋';
};

export const getActivityColor = (type: string) => {
  const colors: Record<string, string> = {
    queue_created: 'blue',
    queue_called: 'yellow',
    queue_completed: 'green',
    queue_cancelled: 'red',
    queue_no_show: 'gray',
    user_registered: 'purple',
    user_login: 'indigo',
    settings_updated: 'orange'
  };
  return colors[type] || 'gray';
};

export const formatActivityTime = (createdAt: Date | string) => {
  const now = new Date();
  const activityTime = new Date(createdAt);
  const diffMs = now.getTime() - activityTime.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  
  return activityTime.toLocaleDateString('id-ID');
};
