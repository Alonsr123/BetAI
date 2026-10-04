export default async function handler(req, res) {
  // =========================================================
  // CORS
  // =========================================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // =========================================================
  // VALIDAR MÉTODO
  // =========================================================
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido"
    });
  }
  try {
    // =======================================================
    // API KEY
    // =======================================================
    const API_KEY = process.env.API_FOOTBALL_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "No existe API_FOOTBALL_KEY en las variables de entorno de Vercel."
      });
    }
    // =======================================================
    // FECHA SOLICITADA
    // =======================================================
    const fechaSolicitada =
      typeof req.query.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : "2026-10-03";
    // =======================================================
    // LIMITACIÓN DEL PLAN FREE
    // API-Football nos indica:
    //
    // Desde: 2026-10-03
    // Hasta: 2026-10-05
    // =======================================================
    const FECHA_MINIMA = "2026-10-03";
    const FECHA_MAXIMA = "2026-10-05";
    let fechaConsulta = fechaSolicitada;
    let fechaAjustada = false;
    if (fechaConsulta < FECHA_MINIMA) {
      fechaConsulta = FECHA_MINIMA;
      fechaAjustada = true;
    }
    if (fechaConsulta > FECHA_MAXIMA) {
      fechaConsulta = FECHA_MAXIMA;
      fechaAjustada = true;
    }
    // =======================================================
    // URL API-FOOTBALL
    // =======================================================
    const url =
      "https://v3.football.api-sports.io/fixtures" +
      "?date=" +
      encodeURIComponent(fechaConsulta) +
      "&timezone=Europe/Madrid";
    // =======================================================
    // PETICIÓN
    // =======================================================
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "Accept": "application/json"
      }
    });
    const data = await response.json();
    // =======================================================
    // SI API-FOOTBALL DEVUELVE ERROR
    // =======================================================
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        http: response.status,
        fechaSolicitada,
        fechaConsulta,
        fechaAjustada,
        resultados: data.results || 0,
        errores: data.errors || {},
        parametros: data.parameters || {},
        partidos: []
      });
    }
    // =======================================================
    // CONVERTIR PARTIDOS
    // =======================================================
    const partidos = (data.response || []).map((item) => ({
      id: item.fixture?.id || null,
      fecha:
        item.fixture?.date ||
        null,
      estado:
        item.fixture?.status?.short ||
        "",
      estadoLargo:
        item.fixture?.status?.long ||
        "",
      local:
        item.teams?.home?.name ||
        "Local",
      visitante:
        item.teams?.away?.name ||
        "Visitante",
      logoLocal:
        item.teams?.home?.logo ||
        "",
      logoVisitante:
        item.teams?.away?.logo ||
        "",
      liga:
        item.league?.name ||
        "Competición",
      pais:
        item.league?.country ||
        "",
      bandera:
        item.league?.flag ||
        "",
      ligaId:
        item.league?.id ||
        null,
      temporada:
        item.league?.season ||
        null,
      jornada:
        item.league?.round ||
        null
    }));
    // =======================================================
    // RESPUESTA FINAL
    // =======================================================
    return res.status(200).json({
      ok: true,
      http: response.status,
      fechaSolicitada,
      fechaConsulta,
      fechaAjustada,
      rangoPlanFree: {
        desde: FECHA_MINIMA,
        hasta: FECHA_MAXIMA
      },
      resultados:
        data.results || partidos.length,
      errores:
        data.errors || {},
      parametros:
        data.parameters || {},
      paging:
        data.paging || {},
      cantidad:
        partidos.length,
      partidos
    });
  } catch (error) {
    // =======================================================
    // ERROR INTERNO
    // =======================================================
    console.error(
      "BetAI fixtures error:",
      error
    );
    return res.status(500).json({
      ok: false,
      http: 500,
      error:
        error.message ||
        "Error interno del servidor",
      partidos: []
    });
  }
}
