import { DateRange } from "./DateRange";

let cachedToken = null;
let tokenExpiry = 0; // epoch millis when token expires

export default {
    async fetch(request, env) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        const BASE_URL =
            env.IS_LOCAL === "true"
                ? "http://localhost:8080"
                : "https://cq-aem-cloud-adoption-query-service-deploy-ethos12-102c74.cloud.adobe.io";

        try {
            if (request.method === "OPTIONS") {
                // ✅ Handle preflight CORS request
                return new Response(null, { headers: corsHeaders });
            }

            const url = new URL(request.url);
            const dateRangeParam = url.searchParams.get('dateRange') || DateRange.LAST_1_MONTH;

            // Validate the dateRange parameter
            const dateRange = Object.values(DateRange).includes(dateRangeParam)
                ? dateRangeParam
                : DateRange.LAST_1_MONTH;

            const apiKey = env.QUERY_SERVICE_API_KEY;
            const imsClientId = env.IMS_CLIENT_ID;
            const imsClientSecret = env.IMS_CLIENT_SECRET;
            const imsCode = env.IMS_CLIENT_CODE;
            const imsTokenUrl = "https://ims-na1.adobelogin.com/ims/token/v1";

            // 1️⃣ Get IMS access token
            const imsResponse = await fetch(imsTokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "insomnia/10.1.1-adobe",
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: imsClientId,
                    client_secret: imsClientSecret,
                    code: imsCode,
                }),
            });

            if (!imsResponse.ok) {
                return new Response(`IMS auth failed: ${imsResponse.status}`, {
                    status: 502,
                    headers: corsHeaders,
                });
            }

            const imsData = await imsResponse.json();
            const authToken = imsData.access_token;

            // Construct URL with dateRange query param
            const queryUrl = new URL(`${BASE_URL}/customerMigrationInfo`);
            queryUrl.searchParams.set("dateRange", dateRange);

            // 2️⃣ Query service
            const queryResponse = await fetch(queryUrl, {
                headers: {
                    "x-api-key": apiKey,
                    Accept: "application/json",
                    Authorization: authToken,
                },
            });

            if (!queryResponse.ok) {
                return new Response(
                    `Query service returned error: ${queryResponse.status}`,
                    {
                        status: 502,
                        headers: corsHeaders,
                    }
                );
            }

            // Read response as text so we can preserve any original formatting. If it's JSON,
            // attempt to parse and compute a tally of ingestions by summing lengths of arrays
            // found anywhere in the JSON structure.
            const text = await queryResponse.text();

            // Compute tally if response is JSON
            let tallyHeader = {};
            try {
                const json = JSON.parse(text);

                // Recursively find arrays and sum their lengths. This is intentionally
                // permissive: it will count any arrays present in the response. If the
                // service returns a top-level array of ingestions this will be its length.
                const computeTally = (obj) => {
                    let count = 0;
                    const seen = new WeakSet();
                    const recurse = (value) => {
                        if (!value || (typeof value !== 'object')) return;
                        if (seen.has(value)) return; // avoid cycles
                        seen.add(value);

                        if (Array.isArray(value)) {
                            count += value.length;
                            // also recurse into array elements in case of nested arrays/objects
                            for (const el of value) recurse(el);
                        } else {
                            for (const k of Object.keys(value)) {
                                recurse(value[k]);
                            }
                        }
                    };
                    recurse(obj);
                    return count;
                };

                const tally = computeTally(json);
                if (tally > 0) {
                    tallyHeader['X-Ingestions-Count'] = String(tally);
                    console.log('ingestions count:', tally);
                } else {
                    console.log('ingestions count: 0 (no arrays found)');
                }
            } catch (e) {
                // Not JSON or parse failed — don't set tally header.
                console.log('query service response not JSON, skipping tally');
            }

            return new Response(text, {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                    ...tallyHeader,
                },
            });
        } catch (err) {
            // ✅ Always include CORS headers even on error
            return new Response(`Worker error: ${err.message}`, {
                status: 500,
                headers: corsHeaders,
            });
        }
    },
};

// ♻️ Helper: Get or reuse IMS token
async function getValidToken(tokenUrl, clientId, clientSecret, code) {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry - 60000) {
        return cachedToken;
    }

    const imsResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "adobe-worker",
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code,
        }),
    });

    if (!imsResponse.ok) {
        throw new Error(`IMS auth failed: ${imsResponse.status}`);
    }

    const imsData = await imsResponse.json();
    cachedToken = imsData.access_token;
    tokenExpiry = now + (imsData.expires_in || 3600) * 1000; // default 1 hour
    return cachedToken;
}
