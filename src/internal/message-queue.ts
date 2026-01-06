import { logger } from "../main";

interface QueuedMessage {
    id: string;
    message: string;
    chatter: "Streamer" | "Bot";
    replyToMessageId?: string;
    timestamp: number;
}

export class MessageQueue {
    private queue: QueuedMessage[] = [];
    private isProcessing = false;
    private processingInterval: NodeJS.Timeout | null = null;
    private readonly processingIntervalMs = 100; // Check queue every 100ms
    private sendMessageCallback: (message: string, chatter: "Streamer" | "Bot", replyToMessageId?: string) => Promise<boolean>;

    constructor(sendMessageCallback: (message: string, chatter: "Streamer" | "Bot", replyToMessageId?: string) => Promise<boolean>) {
        this.sendMessageCallback = sendMessageCallback;
    }

    start(): void {
        if (this.processingInterval) {
            logger.debug("MessageQueue is already running");
            return;
        }

        logger.debug("Starting MessageQueue processor...");
        this.processingInterval = setInterval(() => {
            void this.processQueue();
        }, this.processingIntervalMs);
    }

    stop(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            logger.debug("MessageQueue processor stopped");
        }
    }

    enqueue(message: string, chatter: "Streamer" | "Bot", replyToMessageId?: string): string {
        const id = this.generateId();
        const queuedMessage: QueuedMessage = {
            id,
            message,
            chatter,
            replyToMessageId,
            timestamp: Date.now()
        };

        this.queue.push(queuedMessage);
        logger.debug(`Message queued: ${id} (queue size: ${this.queue.length})`);
        return id;
    }

    getQueueSize(): number {
        return this.queue.length;
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            const queuedMessage = this.queue.shift();
            if (!queuedMessage) {
                return;
            }

            logger.debug(`Processing message from queue: ${queuedMessage.id}`);
            await this.sendMessageCallback(queuedMessage.message, queuedMessage.chatter, queuedMessage.replyToMessageId);
        } catch (error) {
            logger.error(`Error processing queued message: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private generateId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}
