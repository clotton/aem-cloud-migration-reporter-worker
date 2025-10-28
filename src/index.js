export default {
    async fetch(request, env) {
        try {
            const apiKey = env.QUERY_SERVICE_API_KEY;
            const imsClientId = env.IMS_CLIENT_ID;
            const imsClientSecret = env.IMS_CLIENT_SECRET;
            const imsCode = env.IMS_CLIENT_CODE;
            const imsTokenUrl = 'https://ims-na1.adobelogin.com/ims/token/v1';

            // 1️⃣ Call IMS to get an access token
            const imsResponse = await fetch(imsTokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'insomnia/10.1.1-adobe',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: imsClientId,
                    client_secret: imsClientSecret,
                    code: imsCode,
                })
            });

            if (!imsResponse.ok) {
                return new Response(`IMS auth failed: ${imsResponse.status}`, { status: 502 });
            }

            const text = await imsResponse.text();
            const imsData = JSON.parse(text);

            const authToken = imsData.access_token;

            // 2️⃣ Call the query service using the token
            const response = await fetch(
                "https://cq-aem-cloud-adoption-query-service-deploy-ethos12-102c74.cloud.adobe.io/projectCount",
                {
                    headers: {
                        "x-api-key": apiKey,
                        "Accept": "application/json",
                        "Authorization": authToken
                    }
                }
            );

            if (!response.ok) {
                return new Response(
                    `Query service returned an error: ${response.status}`,
                    { status: 502 }
                );
            }

            const data = await response.text();
            return new Response(data, {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });

        } catch (err) {
            return new Response(`Worker error: ${err.message}`, { status: 500 });
        }
    }
};
