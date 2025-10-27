export default {
    async fetch(request, env) {
        try {
            const apiKey = env.QUERY_SERVICE_API_KEY;

            const response = await fetch(
                "https://cq-aem-cloud-adoption-query-service-deploy-ethos12-102c74.cloud.adobe.io/projectCount",
                {
                    headers: {
                        "x-api-key": apiKey,
                        "Accept": "application/json",
                        "Authorization": "eyJhbGciOiJSUzI1NiIsIng1dSI6Imltc19uYTEta2V5LWF0LTEuY2VyIiwia2lkIjoiaW1zX25hMS1rZXktYXQtMSIsIml0dCI6ImF0In0.eyJpZCI6IjE3NjE1OTMwODA3MjhfOTVkMDE4ZmQtYmQ4NS00MmRmLWFlNTUtMGYzYTk1NjE2NTI3X3VlMSIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJjbGllbnRfaWQiOiJhZW1fY2xvdWRfYWRvcHRpb25fcXVlcnlfc2VydmljZSIsInVzZXJfaWQiOiJhZW1fY2xvdWRfYWRvcHRpb25fcXVlcnlfc2VydmljZUBBZG9iZVNlcnZpY2UiLCJhcyI6Imltcy1uYTEiLCJhYV9pZCI6ImFlbV9jbG91ZF9hZG9wdGlvbl9xdWVyeV9zZXJ2aWNlQEFkb2JlU2VydmljZSIsImN0cCI6MCwicGFjIjoiYWVtX2Nsb3VkX2Fkb3B0aW9uX3F1ZXJ5X3NlcnZpY2UiLCJydGlkIjoiMTc2MTU5MzA4MDcyOF80ZTQ2NDViYy1hN2RhLTRmZWYtOTU3MC00N2E4MWM2NTE0MzJfdWUxIiwibW9pIjoiZTAwZTRhOGMiLCJydGVhIjoiMTc2MjgwMjY4MDcyOCIsImV4cGlyZXNfaW4iOiI4NjQwMDAwMCIsInNjb3BlIjoic3lzdGVtIiwiY3JlYXRlZF9hdCI6IjE3NjE1OTMwODA3MjgifQ.LcpttQ6H2RGd0-T8-vja0_aoNYCVaAvkqHWq1JWEuX8j8ok-TBpnkqcM-3fxXzfUxQ1G61WfGCHFa6y0hNhFSyU6f8tBFjb0y3zeiJsE7dl_r7TNyIwMKAb5s1B3QoiZjz1fE5XTqyZfNwbQ64Ewd6wfrE7WTTEwcnjROdoobrum4v7rrjMwwf41aVmFf2fcpFbizYrvFRh8t8Eci2wlq9LZzCXj01vtYSw4hmIUNogfqer-24_BC_tcoUKtd1KwbK1YVogDqMJf5_iKr4pDB9EmgB4kLYTv-bRHeT_mcbQYEW1sA0uBp07JfcjdjhGqjyPvKWkb9O0J_nGLgb9iOQ"
                    }
                }
            );

            if (!response.ok) {
                return new Response(
                    `Query service returned an error: ${response.status}`,
                    { status: 502 }
                );
            }

            const data = await response.text(); // or response.json() if you want JSON
            return new Response(data, {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });

        } catch (err) {
            return new Response(`Worker error: ${err.message}`, { status: 500 });
        }
    }
};
