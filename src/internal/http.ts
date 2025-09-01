import { logger } from "../main";

export interface HttpCallRequest {
    url: string,
    method: string,
    authToken?: string,
    body?: string,
    signal?: AbortSignal | null
    timeout?: number
    userAgent?: string
    headers?: Record<string, string>
    contentType?: string
}

export async function httpCallWithTimeout<T = any>(req: HttpCallRequest): Promise<T> {
    const { url, method, authToken, body, signal, timeout, userAgent, headers, contentType } = req;
    const effectiveTimeout = typeof timeout === "number" && timeout > 0 ? timeout : 10000;

    if (signal && signal.aborted) {
        logger.warn("API request aborted due to previous disconnection.");
        throw new Error("API request aborted");
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
        timeoutController.abort();
    }, effectiveTimeout);

    const reqHeaders: Record<string, string> = Object.assign(
        {},
        authToken ? { "Authorization": `Bearer ${authToken}` } : {},
        userAgent ? { "User-Agent": userAgent } : {},
        headers || {}
    );

    if (body !== undefined && body !== null && body !== "") {
        if (contentType) {
            reqHeaders["Content-Type"] = contentType;
        } else if (/^[^=]+=[^=]+(&[^=]+=[^=]+)*$/.test(body)) {
            reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        } else {
            reqHeaders["Content-Type"] = "application/json";
        }
    }
    reqHeaders["Accept"] = "application/json";

    const signals: AbortSignal[] = [timeoutController.signal, ...(signal ? [signal] : [])];

    const fetchOptions: Record<string, any> = {
        method: method,
        headers: reqHeaders,
        signal: AbortSignal.any(signals),
        redirect: "manual"
    };

    if (body !== undefined && body !== null && body !== "" && !["GET", "HEAD", "DELETE"].includes(method)) {
        fetchOptions['body'] = body;
    }

    const startTime = performance.now();
    let backOff = 500;
    let counter = 0;
    while (true) {
        try {
            counter++;
            const requestStart = performance.now();
            const response = await fetch(url, fetchOptions);
            const duration = performance.now() - requestStart;
            if (response.status === 429) {
                logger.debug(`[${counter}] HTTP ${method} ${url} completed in ${duration}ms with status ${response.status}`);
                const elapsedTime = performance.now() - startTime;
                if (elapsedTime + backOff > effectiveTimeout) {
                    logger.warn(`Rate limit retry would exceed timeout for ${url}. Aborting after ${elapsedTime}ms.`);
                    const error: any = new Error(`Request timeout exceeded during rate limit retries (URL: ${url})`);
                    error.status = 408; // Request Timeout
                    throw error;
                }
                logger.warn(`Rate limit exceeded for ${url}. Retrying in ${backOff}ms...`);
                await new Promise(res => setTimeout(res, backOff));
                backOff = Math.min(backOff * 2, 5000);
                continue;
            }
            logger.debug(`HTTP ${method} ${url} completed in ${duration}ms with status ${response.status}`);
            if (response.status === 301 || response.status === 302) {
                logger.debug(`HTTP request to ${url} was redirected to ${response.url}`);
                continue;
            }
            if (!response.ok) {
                const errorBody = await response.text();
                const error: any = new Error(`HTTP error! Status: ${response.status} (URL: ${url}, payload: ${body}, response: ${errorBody})`);
                error.status = response.status;
                throw error;
            }
            if (response.status === 204) {
                return {} as T;
            }
            return (await response.json()) as T;
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
            if (counter > 1) {
                const duration = performance.now() - startTime;
                logger.debug(`HTTP ${method} ${url} completed in ${duration}ms after ${counter} attempt(s)`);
            }
        }
    }
}
