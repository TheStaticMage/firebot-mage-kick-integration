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
    maxRedirects?: number
}

export async function httpCallWithTimeout<T = any>(req: HttpCallRequest): Promise<T> {
    const { url, method, authToken, body, signal, timeout, userAgent, headers, contentType, maxRedirects } = req;
    const effectiveTimeout = typeof timeout === "number" && timeout > 0 ? timeout : 10000;
    const effectiveMaxRedirects = typeof maxRedirects === "number" && maxRedirects >= 0 ? maxRedirects : 10;

    if (signal && signal.aborted) {
        logger.warn("API request aborted due to previous disconnection.");
        throw new Error("API request aborted");
    }

    const timeoutController = new AbortController();
    let timer = setTimeout(() => {
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

    if (body !== undefined && body !== null && body !== "" && !["GET", "HEAD"].includes(method)) {
        fetchOptions['body'] = body;
    }

    const startTime = performance.now();
    let backOff = 500;
    let counter = 0;
    let redirectCount = 0;
    let currentUrl = url;

    while (true) {
        try {
            counter++;
            const requestStart = performance.now();
            const response = await fetch(currentUrl, fetchOptions);
            const duration = performance.now() - requestStart;
            if (response.status === 429) {
                logger.debug(`[${counter}] HTTP ${method} ${currentUrl} completed in ${duration}ms with status ${response.status}`);
                const elapsedTime = performance.now() - startTime;
                if (elapsedTime + backOff > effectiveTimeout) {
                    logger.warn(`Rate limit retry would exceed timeout for ${currentUrl}. Aborting after ${elapsedTime}ms.`);
                    const error: any = new Error(`Request timeout exceeded during rate limit retries (URL: ${currentUrl})`);
                    error.status = 408; // Request Timeout
                    clearTimeout(timer);
                    throw error;
                }
                logger.warn(`Rate limit exceeded for ${currentUrl}. Retrying in ${backOff}ms...`);
                await new Promise(res => setTimeout(res, backOff));
                backOff = Math.min(backOff * 2, 5000);
                continue;
            }
            logger.debug(`HTTP ${method} ${currentUrl} completed in ${duration}ms with status ${response.status}`);
            if (response.status === 301 || response.status === 302) {
                redirectCount++;
                if (redirectCount > effectiveMaxRedirects) {
                    const error: any = new Error(`Too many redirects (${redirectCount}). Last redirect from ${currentUrl} to ${response.url}`);
                    error.status = 310; // Too Many Redirects (non-standard but descriptive)
                    clearTimeout(timer);
                    throw error;
                }
                if (!response.url) {
                    const error: any = new Error(`Redirect response missing Location header. Status: ${response.status} (URL: ${currentUrl})`);
                    error.status = response.status;
                    clearTimeout(timer);
                    throw error;
                }
                logger.debug(`HTTP request to ${currentUrl} was redirected to ${response.url}`);
                currentUrl = response.url;

                // Reset timeout for the redirected request
                clearTimeout(timer);
                const newTimer = setTimeout(() => {
                    timeoutController.abort();
                }, effectiveTimeout);
                // Update timer reference for cleanup
                timer = newTimer;

                continue;
            }
            if (!response.ok) {
                const errorBody = await response.text();
                const error: any = new Error(`HTTP error! Status: ${response.status} (URL: ${currentUrl}, payload: ${body}, response: ${errorBody})`);
                error.status = response.status;
                clearTimeout(timer);
                throw error;
            }
            if (response.status === 204) {
                clearTimeout(timer);
                if (counter > 1) {
                    const duration = performance.now() - startTime;
                    logger.debug(`HTTP ${method} ${currentUrl} completed in ${duration}ms after ${counter} attempt(s)`);
                }
                return {} as T;
            }
            clearTimeout(timer);
            if (counter > 1) {
                const duration = performance.now() - startTime;
                logger.debug(`HTTP ${method} ${currentUrl} completed in ${duration}ms after ${counter} attempt(s)`);
            }
            return (await response.json()) as T;
        } catch (error) {
            clearTimeout(timer);
            throw error;
        }
    }
}
