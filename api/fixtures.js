export default async function handler(req, res) {
  // ================================
  // CORS
  // ================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  // Responder correctamente a peticiones OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // ================================
  // API
  // ================================
  try {
    const fecha = req.query.date || "2026-09-30";
    const url =
      "https://v3.football.api-sports.io/fixtures" +
      "?date=" +
      encodeURIComponent(fecha) +
      "&timezone=Europe/Madrid";
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": process.env.API_FOOTBALL_KEY,
        "Accept": "application/json"
      }
    });
    const data = await response.json();
    // ================================
    // CONVERTIR PARTIDOS
    // ================================
    const partidos = (data.response || []).map((item) => ({
      id: item.fixture.id,
      fecha: item.fixture.date,
      estado: item.fixture.status.short,
      estadoLargo: item.fixture.status.long,
      local: item.teams.home.name,
      visitante: item.teams.away.name,
      logoLocal: item.teams.home.logo || "",
      logoVisitante: item.teams.away.logo || "",
      liga: item.league.name,
      pais: item.league.country,
      bandera: item.league.flag || ""
    }));
    // ================================
    // RESPUESTA
    // ================================
    return res.status(200).json({
      http: response.status,
      resultados: data.results,
      errores: data.errors,
      parametros: data.parameters,
      partidos
    });
  } catch (error) {
    console.error("BetAI API error:", error);
    return res.status(500).json({
      http: 500,
      error: error.message,
      partidos: []
    });
  }
}
