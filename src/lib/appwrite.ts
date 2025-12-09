import { Client, Account, Storage, Avatars, ID } from 'appwrite';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

// Initialize services
export const account = new Account(client);
export const storage = new Storage(client);
export const avatars = new Avatars(client);

export { client };

// Helper functions
export const appwrite = {
  // Get current user session
  async getCurrentUser() {
    try {
      return await account.get();
    } catch (error) {
      return null;
    }
  },

  // Get current session JWT token
  async getSessionJWT() {
    try {
      const jwt = await account.createJWT();
      return jwt.jwt;
    } catch (error) {
      console.error('Failed to get JWT:', error);
      return null;
    }
  },

  // Create new account
  async createAccount(email: string, password: string, name: string) {
    const userId = ID.unique();

    try {
      // Delete any existing session first
      await account.deleteSession('current');
    } catch (error) {
      // Ignore if no session exists
    }

    // Create account
    const user = await account.create(userId, email, password, name);

    // Automatically log in after account creation
    await account.createEmailPasswordSession(email, password);

    return user;
  },

  // Create email session
  async loginWithEmail(email: string, password: string) {
    try {
      // Delete any existing session first
      await account.deleteSession('current');
    } catch (error) {
      // Ignore if no session exists
    }
    
    try {
      await account.createEmailPasswordSession(email, password);
      // Get and return full user data
      return await account.get();
    } catch (error: any) {
      console.error('Appwrite login error:', error);
      // Throw a more descriptive error
      throw new Error(error.message || 'Failed to connect to authentication server');
    }
  },

  // Logout
  async logout() {
    return await account.deleteSession('current');
  },

  // Upload avatar
  async uploadAvatar(file: File) {
    const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'avatars';
    const fileId = `avatar_${Date.now()}`;

    return await storage.createFile(bucketId, fileId, file);
  },

  // Get avatar URL
  getAvatarUrl(fileId: string) {
    const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'avatars';
    return storage.getFileView(bucketId, fileId);
  },

  // Delete avatar
  async deleteAvatar(fileId: string) {
    const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'avatars';
    return await storage.deleteFile(bucketId, fileId);
  },

  // Get initials avatar URL from Appwrite
  getInitialsAvatar(name: string, size: number = 100) {
    return avatars.getInitials(name, size, size);
  },
};
