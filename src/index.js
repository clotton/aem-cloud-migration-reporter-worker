export default {
    async fetch(request, env, ctx) {
        return new Response("Hello World!", { status: 200 });
    },
};
