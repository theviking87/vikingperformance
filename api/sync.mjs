export function GET(request) {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "VIKING API FUNCIONA",
      method: "GET"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
