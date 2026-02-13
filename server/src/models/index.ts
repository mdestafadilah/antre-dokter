import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcryptjs';

// ==================== User Model ====================
interface UserAttributes {
  id: string;
  fullName: string;
  phoneNumber: string;
  password: string;
  role: 'patient' | 'admin' | 'doctor';
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'role' | 'isActive' | 'lastLogin' | 'createdAt' | 'updatedAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare fullName: string;
  declare phoneNumber: string;
  declare password: string;
  declare role: 'patient' | 'admin' | 'doctor';
  declare isActive: boolean;
  declare lastLogin?: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  async validatePassword(password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password);
  }

  toJSON(): Partial<UserAttributes> {
    const values = Object.assign({}, this.get());
    delete (values as any).password;
    return values;
  }
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      is: /^(\+62|62|0)8[1-9][0-9]{6,10}$/
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [8, 255]
    }
  },
  role: {
    type: DataTypes.ENUM('patient', 'admin', 'doctor'),
    allowNull: false,
    defaultValue: 'patient'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE
  }
}, {
  sequelize,
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// ==================== Queue Model ====================
interface QueueAttributes {
  id: string;
  queueNumber: number;
  appointmentDate: string;
  status: 'waiting' | 'in_service' | 'completed' | 'cancelled' | 'no_show' | 'emergency_cancelled';
  estimatedServiceTime?: number;
  actualServiceTime?: number;
  checkedInAt?: Date;
  serviceStartedAt?: Date;
  serviceCompletedAt?: Date;
  notes?: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface QueueCreationAttributes extends Optional<QueueAttributes, 'id' | 'status' | 'estimatedServiceTime' | 'actualServiceTime' | 'checkedInAt' | 'serviceStartedAt' | 'serviceCompletedAt' | 'notes' | 'createdAt' | 'updatedAt'> {}

class Queue extends Model<QueueAttributes, QueueCreationAttributes> implements QueueAttributes {
  declare id: string;
  declare queueNumber: number;
  declare appointmentDate: string;
  declare status: 'waiting' | 'in_service' | 'completed' | 'cancelled' | 'no_show' | 'emergency_cancelled';
  declare estimatedServiceTime?: number;
  declare actualServiceTime?: number;
  declare checkedInAt?: Date;
  declare serviceStartedAt?: Date;
  declare serviceCompletedAt?: Date;
  declare notes?: string;
  declare userId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Queue.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  queueNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  appointmentDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('waiting', 'in_service', 'completed', 'cancelled', 'no_show', 'emergency_cancelled'),
    allowNull: false,
    defaultValue: 'waiting'
  },
  estimatedServiceTime: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  actualServiceTime: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  checkedInAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  serviceStartedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  serviceCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  sequelize,
  tableName: 'queues',
  timestamps: true,
  indexes: [
    {
      fields: ['appointmentDate', 'queueNumber'],
      unique: true
    },
    {
      fields: ['userId']
    },
    {
      fields: ['status']
    }
  ]
});

// ==================== PracticeSettings Model ====================
interface PracticeSettingsAttributes {
  id: string;
  doctorName: string;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  operatingDays: number[];
  operatingHours: { start: string; end: string };
  maxSlotsPerDay: number;
  allowWalkIn: boolean;
  cancellationDeadline: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PracticeSettingsCreationAttributes extends Optional<PracticeSettingsAttributes, 'id' | 'practiceAddress' | 'practicePhone' | 'operatingDays' | 'operatingHours' | 'maxSlotsPerDay' | 'allowWalkIn' | 'cancellationDeadline' | 'isActive' | 'createdAt' | 'updatedAt'> {}

class PracticeSettings extends Model<PracticeSettingsAttributes, PracticeSettingsCreationAttributes> implements PracticeSettingsAttributes {
  declare id: string;
  declare doctorName: string;
  declare practiceName: string;
  declare practiceAddress?: string;
  declare practicePhone?: string;
  declare operatingDays: number[];
  declare operatingHours: { start: string; end: string };
  declare maxSlotsPerDay: number;
  declare allowWalkIn: boolean;
  declare cancellationDeadline: number;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PracticeSettings.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  doctorName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  practiceName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  practiceAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  practicePhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  operatingDays: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [1, 2, 3, 4, 5]
  },
  operatingHours: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: { start: '08:00', end: '17:00' }
  },
  maxSlotsPerDay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  allowWalkIn: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  cancellationDeadline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 120
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  sequelize,
  tableName: 'practice_settings',
  timestamps: true
});

// ==================== ActivityLog Model ====================
type ActivityLogType = 'queue_created' | 'queue_called' | 'queue_completed' | 'queue_cancelled' | 'queue_no_show' | 'user_registered' | 'user_login' | 'settings_updated';

interface ActivityLogAttributes {
  id: string;
  type: ActivityLogType;
  title: string;
  description?: string;
  userId?: string;
  queueId?: string;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ActivityLogCreationAttributes extends Optional<ActivityLogAttributes, 'id' | 'description' | 'userId' | 'queueId' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class ActivityLog extends Model<ActivityLogAttributes, ActivityLogCreationAttributes> implements ActivityLogAttributes {
  declare id: string;
  declare type: ActivityLogType;
  declare title: string;
  declare description?: string;
  declare userId?: string;
  declare queueId?: string;
  declare metadata?: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ActivityLog.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM(
      'queue_created',
      'queue_called',
      'queue_completed',
      'queue_cancelled',
      'queue_no_show',
      'user_registered',
      'user_login',
      'settings_updated'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  queueId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'queues',
      key: 'id'
    }
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'activity_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// ==================== EmergencyClosure Model ====================
interface EmergencyClosureAttributes {
  id: number;
  closureDate: string;
  reason: string;
  notificationSent: boolean;
  affectedQueuesCount: number;
  reschedulingOffered: boolean;
  createdBy: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EmergencyClosureCreationAttributes extends Optional<EmergencyClosureAttributes, 'id' | 'notificationSent' | 'affectedQueuesCount' | 'reschedulingOffered' | 'isActive' | 'createdAt' | 'updatedAt'> {}

class EmergencyClosure extends Model<EmergencyClosureAttributes, EmergencyClosureCreationAttributes> implements EmergencyClosureAttributes {
  declare id: number;
  declare closureDate: string;
  declare reason: string;
  declare notificationSent: boolean;
  declare affectedQueuesCount: number;
  declare reschedulingOffered: boolean;
  declare createdBy: string;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

EmergencyClosure.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  closureDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  affectedQueuesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  reschedulingOffered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  sequelize,
  tableName: 'emergency_closures',
  timestamps: true,
  indexes: [
    {
      fields: ['closureDate']
    },
    {
      fields: ['isActive']
    }
  ]
});

// ==================== Notification Model ====================
type NotificationType = 'emergency_closure' | 'reschedule_request' | 'reschedule_approved' | 'reschedule_denied' | 'queue_reminder';

interface NotificationAttributes {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionRequired: boolean;
  actionData?: any;
  relatedId?: string;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'isRead' | 'actionRequired' | 'actionData' | 'relatedId' | 'expiresAt' | 'createdAt' | 'updatedAt'> {}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  declare id: string;
  declare userId: string;
  declare type: NotificationType;
  declare title: string;
  declare message: string;
  declare isRead: boolean;
  declare actionRequired: boolean;
  declare actionData?: any;
  declare relatedId?: string;
  declare expiresAt?: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Notification.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('emergency_closure', 'reschedule_request', 'reschedule_approved', 'reschedule_denied', 'queue_reminder'),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  actionRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  actionData: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  relatedId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'notifications',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['isRead']
    },
    {
      fields: ['type']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// ==================== RescheduleRequest Model ====================
interface RescheduleRequestAttributes {
  id: string;
  originalQueueId: string;
  patientId: string;
  emergencyClosureId?: number;
  requestType: 'patient_request' | 'admin_suggestion';
  originalDate: string;
  preferredDates?: string[];
  suggestedDate?: string;
  suggestedQueueNumber?: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  patientResponse: 'waiting' | 'accepted' | 'declined';
  reason?: string;
  processedBy?: string;
  processedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RescheduleRequestCreationAttributes extends Optional<RescheduleRequestAttributes, 'id' | 'emergencyClosureId' | 'preferredDates' | 'suggestedDate' | 'suggestedQueueNumber' | 'status' | 'patientResponse' | 'reason' | 'processedBy' | 'processedAt' | 'expiresAt' | 'createdAt' | 'updatedAt'> {}

class RescheduleRequest extends Model<RescheduleRequestAttributes, RescheduleRequestCreationAttributes> implements RescheduleRequestAttributes {
  declare id: string;
  declare originalQueueId: string;
  declare patientId: string;
  declare emergencyClosureId?: number;
  declare requestType: 'patient_request' | 'admin_suggestion';
  declare originalDate: string;
  declare preferredDates?: string[];
  declare suggestedDate?: string;
  declare suggestedQueueNumber?: number;
  declare status: 'pending' | 'approved' | 'rejected' | 'completed';
  declare patientResponse: 'waiting' | 'accepted' | 'declined';
  declare reason?: string;
  declare processedBy?: string;
  declare processedAt?: Date;
  declare expiresAt?: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RescheduleRequest.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  originalQueueId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  emergencyClosureId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  requestType: {
    type: DataTypes.ENUM('patient_request', 'admin_suggestion'),
    allowNull: false
  },
  originalDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  preferredDates: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  suggestedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  suggestedQueueNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  patientResponse: {
    type: DataTypes.ENUM('waiting', 'accepted', 'declined'),
    allowNull: false,
    defaultValue: 'waiting'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  processedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'reschedule_requests',
  timestamps: true,
  indexes: [
    {
      fields: ['patientId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['patientResponse']
    },
    {
      fields: ['emergencyClosureId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// ==================== Model Relationships ====================
User.hasMany(Queue, { foreignKey: 'userId', as: 'queues' });
Queue.belongsTo(User, { foreignKey: 'userId', as: 'patient' });

User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activities' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Queue.hasMany(ActivityLog, { foreignKey: 'queueId', as: 'activities' });
ActivityLog.belongsTo(Queue, { foreignKey: 'queueId', as: 'queue' });

User.hasMany(EmergencyClosure, { foreignKey: 'createdBy', as: 'emergencyClosures' });
EmergencyClosure.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(RescheduleRequest, { foreignKey: 'patientId', as: 'rescheduleRequests' });
RescheduleRequest.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });

User.hasMany(RescheduleRequest, { foreignKey: 'processedBy', as: 'processedReschedules' });
RescheduleRequest.belongsTo(User, { foreignKey: 'processedBy', as: 'processor' });

Queue.hasMany(RescheduleRequest, { foreignKey: 'originalQueueId', as: 'rescheduleRequests' });
RescheduleRequest.belongsTo(Queue, { foreignKey: 'originalQueueId', as: 'originalQueue' });

EmergencyClosure.hasMany(RescheduleRequest, { foreignKey: 'emergencyClosureId', as: 'rescheduleRequests' });
RescheduleRequest.belongsTo(EmergencyClosure, { foreignKey: 'emergencyClosureId', as: 'emergencyClosure' });

// ==================== Exports ====================
export {
  sequelize,
  User,
  Queue,
  PracticeSettings,
  ActivityLog,
  EmergencyClosure,
  Notification,
  RescheduleRequest
};
