export async function GET() {
  return Response.json({
    ok: true,
    message: "API is running",
    time: new Date().toISOString(),
  });
}
