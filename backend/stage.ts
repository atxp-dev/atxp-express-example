import { Response } from 'express';

// Define the Stage interface for progress tracking
export interface Stage {
  id: string;
  stage: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error' | 'final';
}

// Store active SSE connections
const clients = new Set<Response>();

// Helper function to send SSE updates to all connected clients
export const sendSSEUpdate = (data: any) => {
  console.log('Sending SSE update:', data);
  const sseData = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    client.write(sseData);
  });
};

// Function to add a client to the SSE connections
export const addSSEClient = (client: Response) => {
  clients.add(client);
};

// Function to remove a client from the SSE connections
export const removeSSEClient = (client: Response) => {
  clients.delete(client);
};

// Function to create a stage update object
export const createStageUpdate = (
  requestId: string,
  stage: string,
  message: string,
  status: Stage['status']
): Stage => ({
  id: requestId,
  stage,
  message,
  timestamp: new Date().toISOString(),
  status
});

// Function to send a stage update via SSE
export const sendStageUpdate = (
  requestId: string,
  stage: string,
  message: string,
  status: Stage['status']
) => {
  const stageUpdate = createStageUpdate(requestId, stage, message, status);
  sendSSEUpdate({
    type: 'stage-update',
    ...stageUpdate
  });
};

// Function to send payment notification via SSE
export const sendPaymentUpdate = (payment: {
  accountId: string;
  resourceUrl: string;
  resourceName: string;
  network: string;
  currency: string;
  amount: string;
  iss: string;
}) => {
  sendSSEUpdate({
    type: 'payment',
    payment,
    timestamp: new Date().toISOString()
  });
};
