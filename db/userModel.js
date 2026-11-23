// db/userModel.js
// Mongoose model definition for a User collection

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true, // Automatically creates createdAt and updatedAt fields
  }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
