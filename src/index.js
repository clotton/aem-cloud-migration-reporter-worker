export default {
    async fetch(request, env) {
        try {
            const apiKey = env.QUERY_SERVICE_API_KEY;

            const response = await fetch(
                "https://cq-aem-cloud-adoption-query-service-deploy-ethos12-102c74.cloud.adobe.io/projectCount",
                {
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {
                return new Response("Query service returned an error", { status: 502 });
            }

            const data = await response.text(); // Or response.json() if the endpoint returns JSON
            return new Response(data, {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });

        } catch (err) {
            return new Response(`Worker error: ${err.message}`, { status: 500 });
        }
    }
};
