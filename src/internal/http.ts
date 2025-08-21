import { logger } from "../main";

export async function httpCallWithTimeout(
    url: string,
    method: string,
    authToken = '',
    body = '',
    signal: AbortSignal | null = null,
    timeout = 10000
): Promise<any> {
    if (signal && signal.aborted) {
        logger.warn("API request aborted due to previous disconnection.");
        throw new Error("API request aborted");
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
        if (timeout > 0) {
            timeoutController.abort();
        }
    }, timeout);

    const headers: Record<string, string> = {};
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    if (body) {
        if (/^[^=]+=[^=]+(&[^=]+=[^=]+)*$/.test(body)) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else {
            headers["Content-Type"] = "application/json";
        }
    }
    headers["Accept"] = "application/json";

    const signals: AbortSignal[] = [timeoutController.signal, ...(signal ? [signal] : [])];

    const fetchOptions: Record<string, any> = {
        method: method,
        headers: headers,
        signal: AbortSignal.any(signals),
        redirect: "manual"
    };

    if (body !== '' || method !== "GET" && method !== "HEAD" && method !== "DELETE") {
        // Only include body for methods that require it, or when it is defined
        fetchOptions['body'] = body;
    }

    while (true) {
        try {
            const response = await fetch(url, fetchOptions);
            if (response.status === 301 || response.status === 302) {
                logger.debug(`HTTP request to ${url} was redirected to ${response.url}`);
                continue;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} (URL: ${url}, payload: ${body})`);
            }
            if (response.status === 204) {
                return ({});
            }
            return await response.json();
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
}
