export default async function handler(req, res) {
  // ==========================================
  // CORS
  // ==========================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // ==========================================
  // CONFIGURACIÓN
  // ==========================================
  const API_KEY =
    process.env.API_FOOTBALL_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      http: 500,
      error: "Falta API_FOOTBALL_KEY en las variables de Vercel.",
      partidos: []
    });
  }
  const mode =
    req.query.mode || "date";
  const fecha =
    req.query.date || "2026-09-30";
  const league =
    req.query.league;
  const season =
    req.query.season ||
    new Date(fecha).getFullYear();
  // ==========================================
  // FUNCIÓN API-FOOTBALL
  // ==========================================
  async function apiFootball(endpoint) {
    const response =
      await fetch(
        "https://v3.football.api-sports.io" +
        endpoint,
        {
          method: "GET",
          headers: {
            "x-apisports-key": API_KEY,
            "Accept": "application/json"
          }
        }
      );
    const data =
      await response.json();
    return {
      response,
      data
    };
  }
  // ==========================================
  // CONVERTIR PARTIDO
  // ==========================================
  function convertirPartido(item) {
    return {
      id:
        item.fixture?.id,
      fecha:
        item.fixture?.date,
      estado:
        item.fixture?.status?.short || "",
      estadoLargo:
        item.fixture?.status?.long || "",
      local:
        item.teams?.home?.name || "",
      visitante:
        item.teams?.away?.name || "",
      logoLocal:
        item.teams?.home?.logo || "",
      logoVisitante:
        item.teams?.away?.logo || "",
      liga:
        item.league?.name || "",
      pais:
        item.league?.country || "",
      bandera:
        item.league?.flag || "",
      leagueId:
        item.league?.id || null,
      season:
        item.league?.season || null,
      jornada:
        item.league?.round || ""
    };
  }
  // ==========================================
  // EJECUCIÓN
  // ==========================================
  try {
    // ========================================
    // MODO FECHA
    // ========================================
    if (mode === "date") {
      const endpoint =
        "/fixtures" +
        "?date=" +
        encodeURIComponent(fecha) +
        "&timezone=Europe/Madrid";
      const result =
        await apiFootball(endpoint);
      const partidos =
        (result.data.response || [])
          .map(convertirPartido);
      return res.status(
        result.response.status
      ).json({
        http:
          result.response.status,
        resultados:
          result.data.results,
        errores:
          result.data.errors,
        parametros:
          result.data.parameters,
        partidos
      });
    }
    // ========================================
    // MODO JORNADA
    // ========================================
    if (mode === "round") {
      if (!league) {
        return res.status(400).json({
          http: 400,
          error:
            "Para consultar una jornada hay que indicar league.",
          partidos: []
        });
      }
      // --------------------------------------
      // Buscar jornada actual
      // --------------------------------------
      const roundsEndpoint =
        "/fixtures/rounds" +
        "?league=" +
        encodeURIComponent(league) +
        "&season=" +
        encodeURIComponent(season) +
        "&current=true";
      const roundsResult =
        await apiFootball(
          roundsEndpoint
        );
      let rounds =
        roundsResult.data.response || [];
      // --------------------------------------
      // Si current=true no devuelve nada,
      // obtenemos todas las jornadas.
      // --------------------------------------
      if (rounds.length === 0) {
        const allRoundsEndpoint =
          "/fixtures/rounds" +
          "?league=" +
          encodeURIComponent(league) +
          "&season=" +
          encodeURIComponent(season);
        const allRoundsResult =
          await apiFootball(
            allRoundsEndpoint
          );
        rounds =
          allRoundsResult.data.response || [];
      }
      if (rounds.length === 0) {
        return res.status(200).json({
          http: 200,
          resultados: 0,
          errores: [],
          league:
            Number(league),
          season:
            Number(season),
          jornada:
            null,
          partidos: []
        });
      }
      // Normalmente current=true devuelve
      // una única jornada.
      const jornada =
        rounds[0];
      // --------------------------------------
      // Obtener partidos de esa jornada
      // --------------------------------------
      const fixturesEndpoint =
        "/fixtures" +
        "?league=" +
        encodeURIComponent(league) +
        "&season=" +
        encodeURIComponent(season) +
        "&round=" +
        encodeURIComponent(jornada) +
        "&timezone=Europe/Madrid";
      const fixturesResult =
        await apiFootball(
          fixturesEndpoint
        );
      const partidos =
        (fixturesResult.data.response || [])
          .map(convertirPartido);
      return res.status(
        fixturesResult.response.status
      ).json({
        http:
          fixturesResult.response.status,
        resultados:
          fixturesResult.data.results,
        errores:
          fixturesResult.data.errors,
        parametros:
          fixturesResult.data.parameters,
        league:
          Number(league),
        season:
          Number(season),
        jornada,
        partidos
      });
    }
    // ========================================
    // MODO DESCONOCIDO
    // ========================================
    return res.status(400).json({
      http: 400,
      error:
        "Modo no válido. Usa mode=date o mode=round.",
      partidos: []
    });
  } catch (error) {
    console.error(
      "BetAI API error:",
      error
    );
    return res.status(500).json({
      http: 500,
      error:
        error.message,
      partidos: []
    });
  }
}
