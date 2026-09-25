import { PrismaClient, RoleTarget, UrgencyLevel, Notifications } from '@prisma/client';
import { Response } from 'express';

const prisma = new PrismaClient();

// Manage SSE connections
// Map of role/userId to array of Response objects
const clients: { [key: string]: Response[] } = {};

export const addSSEClient = (key: string, res: Response) => {
  if (!clients[key]) {
    clients[key] = [];
  }
  clients[key].push(res);

  res.on('close', () => {
    clients[key] = clients[key].filter((client) => client !== res);
    if (clients[key].length === 0) {
      delete clients[key];
    }
  });
};

export const broadcastNotification = (notification: Notifications) => {
  const data = `data: ${JSON.stringify(notification)}\n\n`;

  // Send to role targets (like KASUBDIT, PENGELOLA)
  if (clients[notification.role_target]) {
    clients[notification.role_target].forEach((client) => client.write(data));
  }

  // Send to specific user if applicable
  if (notification.user_id && clients[notification.user_id]) {
    clients[notification.user_id].forEach((client) => client.write(data));
  }
};

interface CreateNotificationPayload {
  role_target: RoleTarget;
  user_id?: string;
  title: string;
  message: string;
  action_url: string;
  urgency: UrgencyLevel;
}

export const createNotification = async (payload: CreateNotificationPayload) => {
  try {
    const notification = await prisma.notifications.create({
      data: payload,
    });
    
    // Broadcast instantly via SSE
    broadcastNotification(notification);
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
