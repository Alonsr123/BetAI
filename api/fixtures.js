export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    const fecha = req.query.date || "2026-09-30";
    const API_KEY = process.env.API_FOOTBALL_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Falta API_FOOTBALL_KEY"
      });
    }
    const url =
      "https://v3.football.api-sports.io/fixtures" +
      "?date=" +
      encodeURIComponent(fecha) +
      "&timezone=Europe/Madrid";
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "Accept": "application/json"
      }
    });
    const data = await response.json();
    return res.status(200).json({
      ok: true,
      fechaSolicitada: fecha,
      http: response.status,
      resultados: data.results,
      errores: data.errors,
      parametros: data.parameters,
      paging: data.paging,
      cantidad: Array.isArray(data.response)
        ? data.response.length
        : 0,
      partidos: (data.response || []).map((item) => ({
        id: item.fixture?.id,
        fecha: item.fixture?.date,
        estado: item.fixture?.status?.short,
        local: item.teams?.home?.name,
        visitante: item.teams?.away?.name,
        liga: item.league?.name,
        pais: item.league?.country
      }))
    });
  } catch (error) {
    console.error("BetAI fixtures error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
