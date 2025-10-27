const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Webhook verification endpoint (GET)
router.get('/webhooks', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info('Webhook verification request:', {
    mode,
    token,
    challenge: challenge ? 'present' : 'missing'
  });

  // Check if mode and token are correct
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed:', {
      mode,
      token,
      expectedToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    });
    res.status(403).send('Forbidden');
  }
});

// Webhook endpoint for incoming messages and status updates (POST)
router.post('/webhooks', (req, res) => {
  try {
    const body = req.body;
    
    logger.info('Webhook received:', {
      object: body.object,
      entryCount: body.entry ? body.entry.length : 0,
      fullPayload: JSON.stringify(body, null, 2)
    });

    // Check if it's a WhatsApp message
    if (body.object === 'whatsapp_business_account') {
      body.entry.forEach(entry => {
        entry.changes.forEach(change => {
          if (change.field === 'messages') {
            const messages = change.value.messages;
            const statuses = change.value.statuses;

            // Handle incoming messages
            if (messages) {
              messages.forEach(message => {
                logger.info('Incoming message:', {
                  messageId: message.id,
                  from: message.from,
                  timestamp: message.timestamp,
                  type: message.type
                });
                
                // Here you can add logic to process incoming messages
                // For example, auto-replies, command processing, etc.
              });
            }

            // Handle message status updates
            if (statuses) {
              statuses.forEach(status => {
                logger.info('Message status update:', {
                  messageId: status.id,
                  status: status.status,
                  timestamp: status.timestamp,
                  recipientId: status.recipient_id
                });

                // Log delivery failures
                if (status.status === 'failed') {
                  logger.warn('Message delivery failed:', {
                    messageId: status.id,
                    error: status.errors,
                    recipientId: status.recipient_id
                  });
                }

                // Here you can add logic to update message status in your database
                // For example, update alert status, retry failed messages, etc.
              });
            }
          }
        });
      });
    }

    // Always respond with 200 OK to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
