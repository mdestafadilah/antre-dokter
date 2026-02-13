import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcryptjs';

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

export default User;
