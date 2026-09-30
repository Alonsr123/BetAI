export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?league=140&season=2026&from=2026-09-30&to=2026-10-07&timezone=Europe/Madrid",
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    const data = await response.json();

    const partidos = (data.response || []).map((item) => ({
      id: item.fixture.id,
      fecha: item.fixture.date,
      estado: item.fixture.status.short,
      local: item.teams.home.name,
      visitante: item.teams.away.name,
      liga: item.league.name,
      pais: item.league.country
    }));

    res.status(200).json({
      resultados: data.results,
      errores: data.errors,
      partidos
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
