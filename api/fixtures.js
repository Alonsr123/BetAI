export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?league=140&season=2025",
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Error al consultar API-Football"
      });
    }

    const data = await response.json();

    const partidos = (data.response || []).map((item) => ({
      id: item.fixture.id,
      fecha: item.fixture.date,
      estado: item.fixture.status.short,
      local: item.teams.home.name,
      visitante: item.teams.away.name,
      logoLocal: item.teams.home.logo,
      logoVisitante: item.teams.away.logo,
      liga: item.league.name,
      pais: item.league.country
    }));

    res.status(200).json({
      total: partidos.length,
      partidos
    });

  } catch (error) {
    res.status(500).json({
      error: "Error interno",
      detalle: error.message
    });
  }
}
