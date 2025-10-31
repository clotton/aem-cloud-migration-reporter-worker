let cachedToken = null;
let tokenExpiry = 0; // epoch millis when token expires

export default {
    async fetch(request, env) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        try {
            if (request.method === "OPTIONS") {
                // ✅ Handle preflight CORS request
                return new Response(null, { headers: corsHeaders });
            }

            const url = new URL(request.url);
            const pathname = url.pathname;
            const imsOrgId = url.searchParams.get("imsOrgId");

            const apiKey = env.QUERY_SERVICE_API_KEY;
            const imsClientId = env.IMS_CLIENT_ID;
            const imsClientSecret = env.IMS_CLIENT_SECRET;
            const imsCode = env.IMS_CLIENT_CODE;
            const imsTokenUrl = "https://ims-na1.adobelogin.com/ims/token/v1";

            // 1️⃣ Get (or reuse) IMS token
            let authToken = await getValidToken(imsTokenUrl, imsClientId, imsClientSecret, imsCode);

            // 2️⃣ Build Query Service URL
            let queryUrl;
            if (pathname === "/bpaReports") {
                if (!imsOrgId) {
                    return new Response("Missing imsOrgId parameter", {
                        status: 400,
                        headers: corsHeaders,
                    });
                }
                queryUrl = `https://cq-aem-cloud-adoption-query-service-deploy-ethos12-102c74.cloud.adobe.io/bpaReports?imsOrgId=${encodeURIComponent(imsOrgId)}`;
            } else if (pathname === "/ingestionsLast30Days") {
                queryUrl = "https://cq-aem-cloud-adoption-query-service-deploy-ethos12-102c74.cloud.adobe.io/ingestionsLast30Days";
            } else {
                return new Response("Not found", { status: 404, headers: corsHeaders });
            }

            // 3️⃣ Query the service
            let queryResponse = await fetch(queryUrl, {
                headers: {
                    "x-api-key": apiKey,
                    Accept: "application/json",
                    Authorization: authToken,
                },
            });

            // 🔄 Retry once if token expired/invalid
            if (queryResponse.status === 401 || queryResponse.status === 403) {
                console.warn("IMS token invalid or expired — refreshing...");
                cachedToken = null;
                authToken = await getValidToken(imsTokenUrl, imsClientId, imsClientSecret, imsCode);
                queryResponse = await fetch(queryUrl, {
                    headers: {
                        "x-api-key": apiKey,
                        Accept: "application/json",
                        Authorization: authToken,
                    },
                });
            }

            if (!queryResponse.ok) {
                return new Response(
                    `Query service returned error: ${queryResponse.status}`,
                    { status: 502, headers: corsHeaders }
                );
            }

            // 4️⃣ Read text and compute tally (if JSON)
            const text = await queryResponse.text();
            let tallyHeader = {};

            try {
                const json = JSON.parse(text);

                const computeTally = (obj) => {
                    let count = 0;
                    const seen = new WeakSet();
                    const recurse = (value) => {
                        if (!value || typeof value !== "object") return;
                        if (seen.has(value)) return;
                        seen.add(value);

                        if (Array.isArray(value)) {
                            count += value.length;
                            for (const el of value) recurse(el);
                        } else {
                            for (const k of Object.keys(value)) recurse(value[k]);
                        }
                    };
                    recurse(obj);
                    return count;
                };

                const tally = computeTally(json);
                if (tally > 0) {
                    const headerName =
                        pathname === "/bpaReports" ? "X-BpaReports-Count" : "X-Ingestions-Count";
                    tallyHeader[headerName] = String(tally);
                    console.log(`${headerName}:`, tally);
                } else {
                    console.log("count: 0 (no arrays found)");
                }
            } catch (e) {
                console.log("query service response not JSON, skipping tally");
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
