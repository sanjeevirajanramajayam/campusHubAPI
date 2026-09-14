import { EventEmitter } from 'events';
import type { Response } from 'express';
import { redis } from '../redis/client.js';
import { logger } from '../../common/logger.js';

export type FeedEventType =
  | 'CONNECTED'
  | 'POST_CREATED'
  | 'POST_VOTED'
  | 'POST_DELETED'
  | 'COMMENT_CREATED'
  | 'COMMENT_VOTED'
  | 'COMMENT_DELETED';

export interface FeedEventPayload {
  type: FeedEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

const REDIS_FEED_CHANNEL = 'campushub:feed_events';

/**
 * Real-Time Feed Event Service
 *
 * Combines Redis Pub/Sub for distributed horizontal scale across instances
 * with an in-memory EventEmitter for single-node / local test resilience.
 */
export class FeedEventService {
  private localEmitter = new EventEmitter();
  private clients = new Set<Response>();
  private subscriberClient: typeof redis | null = null;
  private isRedisSubscribed = false;

  constructor() {
    this.localEmitter.setMaxListeners(500);
    this.initRedisSubscription();

    // Send keep-alive comments every 25 seconds to prevent proxy disconnects
    setInterval(() => {
      this.broadcastKeepAlive();
    }, 25000);
  }

  private initRedisSubscription() {
    try {
      this.subscriberClient = redis.duplicate();
      this.subscriberClient.subscribe(REDIS_FEED_CHANNEL, (err) => {
        if (err) {
          logger.warn(
            { err },
            'Could not subscribe to Redis feed channel, using local EventEmitter fallback',
          );
          return;
        }
        this.isRedisSubscribed = true;
        logger.info(`📡 Subscribed to Redis real-time channel: ${REDIS_FEED_CHANNEL}`);
      });

      this.subscriberClient.on('message', (channel, message) => {
        if (channel === REDIS_FEED_CHANNEL) {
          try {
            const event: FeedEventPayload = JSON.parse(message);
            this.broadcastToHttpClients(event);
          } catch (e) {
            logger.error({ err: e }, 'Failed to parse incoming Redis feed event');
          }
        }
      });
    } catch (err) {
      logger.warn(
        { err },
        'Redis duplicate subscriber initialization failed; operating in local mode',
      );
    }
  }

  /**
   * Broadcast an event to all connected clients and publish to Redis
   */
  async publishEvent(type: FeedEventType, data: Record<string, unknown>): Promise<void> {
    try {
      const payload: FeedEventPayload = {
        type,
        data,
        timestamp: new Date().toISOString(),
      };

      // If Redis is active, publish to Redis; subscribers on all nodes will broadcast
      if (this.isRedisSubscribed && this.subscriberClient) {
        try {
          await redis.publish(REDIS_FEED_CHANNEL, JSON.stringify(payload));
          return;
        } catch (err) {
          logger.warn({ err }, 'Redis publish failed, falling back to direct in-process broadcast');
        }
      }

      // Local in-process fallback
      this.broadcastToHttpClients(payload);
    } catch (outerErr) {
      logger.error({ err: outerErr }, 'Unexpected error in feed event broadcasting');
    }
  }

  /**
   * Register a new SSE HTTP response connection
   */
  addClient(res: Response): void {
    this.clients.add(res);
    logger.debug(`SSE Client connected. Active clients: ${this.clients.size}`);

    // Send initial handshake event
    const handshake: FeedEventPayload = {
      type: 'CONNECTED',
      data: { message: 'SSE Stream active', activeListeners: this.clients.size },
      timestamp: new Date().toISOString(),
    };
    this.writeEvent(res, handshake);

    res.on('close', () => {
      this.clients.delete(res);
      logger.debug(`SSE Client disconnected. Remaining clients: ${this.clients.size}`);
    });
  }

  private broadcastToHttpClients(event: FeedEventPayload): void {
    const formatted = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(formatted);
      } catch (err) {
        logger.warn({ err }, 'Error writing to SSE client, removing');
        this.clients.delete(client);
      }
    }
  }

  private broadcastKeepAlive(): void {
    for (const client of this.clients) {
      try {
        client.write(': keep-alive ping\n\n');
      } catch {
        this.clients.delete(client);
      }
    }
  }

  private writeEvent(res: Response, event: FeedEventPayload): void {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      this.clients.delete(res);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const feedEventService = new FeedEventService();
