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

            // 2️⃣ Query service
            const queryResponse = await fetch(
                "https://cq-aem-cloud-adoption-query-service-deploy-ethos12-102c74.cloud.adobe.io/ingestionsLast30Days",
                {
                    headers: {
                        "x-api-key": apiKey,
                        Accept: "application/json",
                        Authorization: authToken,
                    },
                }
            );

            if (!queryResponse.ok) {
                return new Response(
                    `Query service returned error: ${queryResponse.status}`,
                    {
                        status: 502,
                        headers: corsHeaders,
                    }
                );
            }

            const data = await queryResponse.text();
            return new Response(data, {
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
