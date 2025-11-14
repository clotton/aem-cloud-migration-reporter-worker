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
            const searchBy = url.searchParams.get("searchBy") || '';

            await logEvent(`👤 *${searchBy}* searched migrations with dateRange: ${dateRangeParam}`, env);

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

            const text = await queryResponse.text();

            return new Response(text, {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
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

async function logEvent(message, env) {
    const webhookUrl = env.SLACK_WEBHOOK_URL;
    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
    });
}
