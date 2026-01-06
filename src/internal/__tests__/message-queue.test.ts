import { MessageQueue } from "../message-queue";

jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    }
}));

jest.useFakeTimers();

describe("MessageQueue", () => {
    let messageQueue: MessageQueue;
    let sendMessageCallback: jest.Mock;

    beforeEach(() => {
        sendMessageCallback = jest.fn().mockResolvedValue(true);
        messageQueue = new MessageQueue(sendMessageCallback);
    });

    afterEach(() => {
        messageQueue.stop();
        jest.clearAllTimers();
    });

    describe("enqueue", () => {
        it("should add a message to the queue", () => {
            const id = messageQueue.enqueue("Hello, world!", "Streamer");
            expect(id).toMatch(/^msg_\d+_[a-z0-9]+$/);
            expect(messageQueue.getQueueSize()).toBe(1);
        });

        it("should add multiple messages to the queue", () => {
            messageQueue.enqueue("First message", "Streamer");
            messageQueue.enqueue("Second message", "Bot");
            messageQueue.enqueue("Third message", "Streamer");
            expect(messageQueue.getQueueSize()).toBe(3);
        });

        it("should include optional replyToMessageId", () => {
            const id = messageQueue.enqueue("Reply message", "Streamer", "reply-id-123");
            expect(id).toBeDefined();
            expect(messageQueue.getQueueSize()).toBe(1);
        });
    });

    describe("start and processQueue", () => {
        it("should process messages from the queue", async () => {
            messageQueue.enqueue("Test message", "Streamer");
            messageQueue.start();

            await jest.advanceTimersByTimeAsync(150);

            expect(sendMessageCallback).toHaveBeenCalledTimes(1);
            expect(sendMessageCallback).toHaveBeenCalledWith("Test message", "Streamer", undefined);
            expect(messageQueue.getQueueSize()).toBe(0);
        });

        it("should process multiple messages in order", async () => {
            messageQueue.enqueue("First", "Streamer");
            messageQueue.enqueue("Second", "Bot");
            messageQueue.enqueue("Third", "Streamer", "reply-id");

            messageQueue.start();

            await jest.advanceTimersByTimeAsync(350);

            expect(sendMessageCallback).toHaveBeenCalledTimes(3);
            expect(sendMessageCallback).toHaveBeenNthCalledWith(1, "First", "Streamer", undefined);
            expect(sendMessageCallback).toHaveBeenNthCalledWith(2, "Second", "Bot", undefined);
            expect(sendMessageCallback).toHaveBeenNthCalledWith(3, "Third", "Streamer", "reply-id");
            expect(messageQueue.getQueueSize()).toBe(0);
        });

        it("should process messages sequentially", async () => {
            let firstCallResolve: ((value: boolean) => void) | undefined;
            const firstCallPromise = new Promise<boolean>((resolve) => {
                firstCallResolve = resolve;
            });

            let callCount = 0;
            sendMessageCallback.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return firstCallPromise;
                }
                return Promise.resolve(true);
            });

            messageQueue.enqueue("First", "Streamer");
            messageQueue.enqueue("Second", "Streamer");

            messageQueue.start();

            await jest.advanceTimersByTimeAsync(100);
            expect(sendMessageCallback).toHaveBeenCalledTimes(1);

            if (firstCallResolve) {
                firstCallResolve(true);
            }
            await jest.advanceTimersByTimeAsync(100);
            expect(sendMessageCallback).toHaveBeenCalledTimes(2);
        });

        it("should handle errors in sendMessageCallback", async () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
            sendMessageCallback.mockRejectedValue(new Error("Send failed"));

            messageQueue.enqueue("Test message", "Streamer");
            messageQueue.start();

            await jest.advanceTimersByTimeAsync(150);

            expect(sendMessageCallback).toHaveBeenCalledTimes(1);
            expect(messageQueue.getQueueSize()).toBe(0);
            consoleErrorSpy.mockRestore();
        });

        it("should not process messages if queue is empty", async () => {
            messageQueue.start();

            await jest.advanceTimersByTimeAsync(500);

            expect(sendMessageCallback).not.toHaveBeenCalled();
        });
    });

    describe("stop", () => {
        it("should stop processing the queue", async () => {
            messageQueue.enqueue("Test message", "Streamer");
            messageQueue.start();
            messageQueue.stop();

            await jest.advanceTimersByTimeAsync(500);

            expect(sendMessageCallback).not.toHaveBeenCalled();
            expect(messageQueue.getQueueSize()).toBe(1);
        });

        it("should allow restart after stop", async () => {
            messageQueue.enqueue("Test message", "Streamer");
            messageQueue.start();
            messageQueue.stop();

            await jest.advanceTimersByTimeAsync(500);
            expect(sendMessageCallback).not.toHaveBeenCalled();

            messageQueue.start();
            await jest.advanceTimersByTimeAsync(150);

            expect(sendMessageCallback).toHaveBeenCalledTimes(1);
            expect(messageQueue.getQueueSize()).toBe(0);
        });
    });

    describe("getQueueSize", () => {
        it("should return 0 for empty queue", () => {
            expect(messageQueue.getQueueSize()).toBe(0);
        });

        it("should return correct size after adding messages", () => {
            messageQueue.enqueue("First", "Streamer");
            expect(messageQueue.getQueueSize()).toBe(1);

            messageQueue.enqueue("Second", "Bot");
            expect(messageQueue.getQueueSize()).toBe(2);
        });

        it("should decrease after processing", async () => {
            messageQueue.enqueue("First", "Streamer");
            messageQueue.enqueue("Second", "Bot");
            expect(messageQueue.getQueueSize()).toBe(2);

            messageQueue.start();
            await jest.advanceTimersByTimeAsync(150);

            expect(messageQueue.getQueueSize()).toBe(1);
        });
    });
});
