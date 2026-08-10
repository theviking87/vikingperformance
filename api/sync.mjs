export default function handler(request) {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "VIKING API FUNCIONA",
      method: request.method
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
