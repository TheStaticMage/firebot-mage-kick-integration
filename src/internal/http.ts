import { IntegrationConstants } from "../constants";
import { logger } from "../main";

export async function httpCallWithTimeout(
    url: string,
    method: string,
    authToken = '',
    body = '',
    signal: AbortSignal | null = null,
    timeout = 10000
): Promise<any> {
    return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] API request aborted due to previous disconnection.`);
            reject(new Error("API request aborted"));
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
            signal: AbortSignal.any(signals)
        };

        if (body !== '' || method !== "GET" && method !== "HEAD" && method !== "DELETE") {
            // Only include body for methods that require it, or when it is defined
            fetchOptions['body'] = body;
        }

        fetch(url, fetchOptions)
            .then((response) => {
                clearTimeout(timer);
                if (!response.ok) {
                    reject(new Error(`HTTP error! Status: ${response.status} (URL: ${url}, payload: ${body})`));
                }
                if (response.status === 204) {
                    resolve({}); // No content to return
                    return;
                }
                return response.json();
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                reject(error);
            })
            .finally(() => {
                if (timer) {
                    clearTimeout(timer);
                }
            });
    });
}
